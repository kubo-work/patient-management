import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { applyMigrations } from "@repo/db/migrations";
import {
    APP_ORIGIN,
    APP_PORT,
    DATABASE_PORT,
    DATABASE_URL,
    JWT_SECRET_KEY,
} from "../support/testEnvironment.ts";

// Playwright の webServer から起動される E2E 用サーバ。
// 1. インメモリの PGlite（Postgres 18）を起動し、マイグレーションを適用する
// 2. pglite-socket で TCP に公開する（アプリとテストの両方がここへ接続する）
// 3. E2E 用の環境変数で apps/web をビルドし、next start で起動する
//
// Node の型注釈の除去（type stripping）でそのまま実行するため、
// 型注釈以外の TypeScript 固有の構文（enum など）は使わない。

const repositoryRoot = join(import.meta.dirname, "../..");

// apps/web/.env の値（手元の DB や API の URL）が紛れ込まないよう、
// アプリが読む環境変数はすべてここで上書きする。Next.js はプロセスの環境変数を .env より優先する。
const appEnvironment = {
    ...process.env,
    DATABASE_URL,
    JWT_SECRET_KEY,
    // フロントと API は同じ next start の同一オリジンで動く（API は /api にマウントされている）。
    CLIENT_URL: APP_ORIGIN,
    NEXT_PUBLIC_API_URL: `${APP_ORIGIN}/api`,
    // 本番では Cookie に domain を付けるが、localhost では付けない。
    SERVER_DOMAIN: "",
    // api サブドメインへの書き換えを無効にする。
    API_SUBDOMAIN_HOST: "",
};

const database = await PGlite.create();
await applyMigrations((sql) => database.exec(sql));

// Next.js の node-postgres のプール（既定の最大 10）と、テスト側の初期化用の接続を合わせて受け付ける。
// pglite-socket は上限を超えた接続を待たせずに拒否する。
const databaseServer = new PGLiteSocketServer({
    db: database,
    host: "127.0.0.1",
    port: DATABASE_PORT,
    maxConnections: 20,
});
await databaseServer.start();

// NEXT_PUBLIC_API_URL はビルド時に埋め込まれるため、E2E 用の値で毎回ビルドする。
const buildResult = spawnSync("bun", ["run", "build:web"], {
    cwd: repositoryRoot,
    env: appEnvironment,
    stdio: "inherit",
});
if (buildResult.status !== 0) {
    await databaseServer.stop();
    await database.close();
    throw new Error(`apps/web のビルドに失敗しました（終了コード: ${buildResult.status}）。`);
}

const appProcess = spawn("bun", ["run", "start", "--port", String(APP_PORT)], {
    cwd: join(repositoryRoot, "apps/web"),
    env: appEnvironment,
    stdio: "inherit",
});

// Playwright はテスト終了時にこのプロセスへシグナルを送る。アプリを止め、
// 後片付けはアプリの終了を受けた 1 か所（下の exit）にまとめる。
const stopApp = (): void => {
    appProcess.kill("SIGTERM");
};
process.on("SIGINT", stopApp);
process.on("SIGTERM", stopApp);
appProcess.on("exit", async (exitCode) => {
    await databaseServer.stop();
    await database.close();
    process.exit(exitCode ?? 0);
});
