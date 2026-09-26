import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeEach, inject } from "vitest";

// 結合テスト（api-integration project）の setupFiles。テストファイルごとに、
// そのファイル専用のインメモリ Postgres（PGlite）を立てる。
// マイグレーションを適用済みの状態は globalSetup（pgliteTemplateGlobalSetup.ts）が
// 1 回だけ作ってダンプしており、ここではそこから復元する。
//
// PGlite を Prisma へ直接つなぐアダプタ（pglite-prisma-adapter）は使わず、
// pglite-socket で Postgres のワイヤプロトコルを話す TCP サーバとして公開し、
// 本番と同じ @repo/db（PrismaPg = node-postgres）から接続させる。
// repository は @repo/db のシングルトンを import しているため、
// DATABASE_URL を差し替えるだけで本番コードに手を入れずに済む。
//
// setupFiles はテストファイルより先に評価されるため、ここで DATABASE_URL を
// 設定すれば、テストファイルが @repo/db を読み込む時点で接続先はこの PGlite になる。
// このファイル自身は @repo/db を静的に import してはならない（設定前に読み込まれるため）。

const templateDump = new Blob([await readFile(inject("pgliteTemplatePath"))]);
const database = await PGlite.create({ loadDataDir: templateDump });

// pglite-socket は上限を超えた接続を待たせずに拒否する（"Too many connections"）。
// node-postgres の Pool の既定の最大接続数（10）に合わせる。
// PGlite 自体は単一セッションだが、pglite-socket のクエリキューはトランザクション中に
// 同じ接続のクエリだけを先に通すため、prisma.$transaction も正しく隔離される。
const server = new PGLiteSocketServer({ db: database, port: 0, maxConnections: 10 });
await server.start();

// 手元のシェルに本番の DATABASE_URL が入っていても、必ずこの PGlite を向くよう無条件に上書きする。
process.env.DATABASE_URL = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;

const userTableNames = (
    await database.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    )
).rows.map((row) => `"public"."${row.tablename}"`);

// 各テストを空の DB から始める。RESTART IDENTITY で採番も 1 に戻す。
// Issue #288 は「テストごとにトランザクションでロールバック」を挙げていたが、
// repository が @repo/db のシングルトンを直接使う構造ではテスト側から
// トランザクションを差し込めないため、TRUNCATE で初期化する。
beforeEach(async () => {
    await database.exec(`TRUNCATE ${userTableNames.join(", ")} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
    // 先に node-postgres のプールを閉じる。サーバを先に止めると、プールに残った
    // アイドル接続が切断を error イベントとして受け取り、ワーカーが落ちる。
    const { prisma } = await import("@repo/db");
    await prisma.$disconnect();
    await server.stop();
    await database.close();
});
