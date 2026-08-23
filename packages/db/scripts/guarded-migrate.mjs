// prisma migrate dev は既存のスキーマとデータを変更するため、
// 接続先がローカル DB であることを確認してから実行する。
//
// DATABASE_URL の供給元は現在 packages/api/.env（呼び出し側が --env-file で読み込む）。
// 環境変数の配置は #282（Neon 移行）で整理する予定。
import { spawnSync } from "node:child_process";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1"];

const subcommand = process.argv[2];
if (!subcommand) {
    console.error("実行するサブコマンドを指定してください（例: dev）。");
    process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error(
        "DATABASE_URL が設定されていません。packages/api/.env に定義されているか確認してください。"
    );
    process.exit(1);
}

let hostname;
try {
    hostname = new URL(databaseUrl).hostname;
} catch {
    console.error("DATABASE_URL を URL として解釈できませんでした。");
    process.exit(1);
}

const isLocalDatabase = LOCAL_HOSTNAMES.includes(hostname);
const isExplicitlyAllowed = process.env.ALLOW_REMOTE_MIGRATE === "1";

if (!isLocalDatabase && !isExplicitlyAllowed) {
    console.error(
        [
            "",
            `接続先がローカル DB ではありません: ${hostname}`,
            `prisma migrate ${subcommand} はスキーマを変更するため、実行を中止しました。`,
            "",
            "ローカルの DB を向けるか、リモートへの実行が意図どおりであれば",
            `  ALLOW_REMOTE_MIGRATE=1 bun run migrate:${subcommand}`,
            "として再実行してください。",
            "",
        ].join("\n")
    );
    process.exit(1);
}

if (isExplicitlyAllowed && !isLocalDatabase) {
    console.warn(`[警告] リモート DB (${hostname}) に対して migrate ${subcommand} を実行します。`);
}

const result = spawnSync("prisma", ["migrate", subcommand], {
    stdio: "inherit",
    shell: true,
});
process.exit(result.status ?? 1);
