// prisma migrate dev は既存のスキーマとデータを変更するため、
// 接続先がローカル DB であることを確認してから実行する。
//
// DATABASE_URL / DIRECT_URL の供給元は packages/db/.env（呼び出し側が --env-file で読み込む）。
// prisma.config.ts の datasource が DIRECT_URL を読むため、
// migrate が実際に接続するのは DIRECT_URL の方になる。
// DATABASE_URL だけを見ると「pooled はローカル・直結は本番」という組み合わせを見逃すので、
// 両方を検査する。
import { spawnSync } from "node:child_process";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1"];
const REQUIRED_CONNECTION_VARIABLES = ["DATABASE_URL", "DIRECT_URL"];

const subcommand = process.argv[2];
if (!subcommand) {
    console.error("実行するサブコマンドを指定してください（例: dev）。");
    process.exit(1);
}

const remoteConnections = [];

for (const variableName of REQUIRED_CONNECTION_VARIABLES) {
    const connectionUrl = process.env[variableName];

    if (!connectionUrl) {
        console.error(
            `${variableName} が設定されていません。packages/db/.env に定義されているか確認してください。`
        );
        process.exit(1);
    }

    let hostname;
    try {
        hostname = new URL(connectionUrl).hostname;
    } catch {
        console.error(`${variableName} を URL として解釈できませんでした。`);
        process.exit(1);
    }

    if (!LOCAL_HOSTNAMES.includes(hostname)) {
        remoteConnections.push({ variableName, hostname });
    }
}

const isExplicitlyAllowed = process.env.ALLOW_REMOTE_MIGRATE === "1";

if (remoteConnections.length > 0 && !isExplicitlyAllowed) {
    console.error(
        [
            "",
            "接続先がローカル DB ではありません:",
            ...remoteConnections.map(({ variableName, hostname }) => `  ${variableName} -> ${hostname}`),
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

if (isExplicitlyAllowed && remoteConnections.length > 0) {
    const hostnameList = remoteConnections.map(({ hostname }) => hostname).join(", ");
    console.warn(`[警告] リモート DB (${hostnameList}) に対して migrate ${subcommand} を実行します。`);
}

// このスクリプトは packages/db を作業ディレクトリとして実行される。
// サブコマンド以降の引数（--name 等）はそのまま prisma へ渡す。渡せないと
// migrate dev がマイグレーション名を対話で尋ね、自動実行が止まる。
const forwardedArguments = process.argv.slice(3);

const result = spawnSync(
    "prisma",
    ["migrate", subcommand, "--config", "prisma.config.ts", ...forwardedArguments],
    {
        stdio: "inherit",
        shell: true,
    }
);
process.exit(result.status ?? 1);
