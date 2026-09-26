import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { buildTruncateAllTablesSql, USER_TABLES_QUERY } from "@repo/db/testing";
import { inject } from "vitest";

// 結合テスト用のインメモリ Postgres（PGlite）を、ワーカーごとに 1 つだけ立てる。
// api-integration project は isolate: false のため、このモジュールはワーカー内でキャッシュされ、
// 最上位の処理はワーカーの最初のテストファイルでだけ実行される。
// テストファイルごとに作り直すと、PGlite と Prisma の初期化（約 1 秒）をファイルの数だけ繰り返すことになる。
//
// マイグレーションを適用済みの状態は globalSetup（pgliteTemplateGlobalSetup.ts）が
// 1 回だけ作ってダンプしており、ここではそこから復元する。
//
// PGlite を Prisma へ直接つなぐアダプタ（pglite-prisma-adapter）は使わず、
// pglite-socket で Postgres のワイヤプロトコルを話す TCP サーバとして公開し、
// 本番と同じ @repo/db（PrismaPg = node-postgres）から接続させる。
// repository は @repo/db のシングルトンを import しているため、
// DATABASE_URL を差し替えるだけで本番コードに手を入れずに済む。
//
// このモジュールは @repo/db を import してはならない（DATABASE_URL の設定前に読み込まれるため）。
//
// サーバと PGlite は明示的には止めない。ワーカーの終了時にプロセスごと片付けられる。

const createTestDatabase = async (): Promise<{ truncateAllTables: () => Promise<void> }> => {
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

    // テーブルの構成はワーカーの実行中に変わらないため、空にする SQL は 1 回だけ組み立てる。
    const userTableNames = (await database.query<{ tablename: string }>(USER_TABLES_QUERY)).rows.map(
        (row) => row.tablename
    );
    const truncateAllTablesSql = buildTruncateAllTablesSql(userTableNames);

    const truncateAllTables = async (): Promise<void> => {
        await database.exec(truncateAllTablesSql);
    };
    return { truncateAllTables };
};

// モジュールはワーカー内でキャッシュされるため、この Promise はワーカーごとに 1 つだけ作られる。
const testDatabase = createTestDatabase();

// 起動を import の副作用に頼らず、呼び出し側が明示的に待てるようにする。
// 未使用の import は TypeScript の変換で削除されるため、副作用だけに頼ると起動が抜け落ちる。
export const startTestDatabase = (): Promise<{ truncateAllTables: () => Promise<void> }> =>
    testDatabase;
