// 既存の平文パスワードを argon2id のハッシュへ一括変換する（ADR 0005 決定 7）。
//
// 冪等である。既に "$argon2" で始まる値は飛ばすため、複数回実行しても
// 二重ハッシュ化しない。二重ハッシュ化されたアカウントは元のパスワードでは
// ログインできなくなり復旧不能なので、この防御は必須である。
//
// 本番（Neon）への適用は #287 の切り替えと同時に行う。それより前に適用すると
// render-legacy の平文照合が通らなくなり、本番のログインが止まる。
import { prisma } from "@repo/db";
import { hashPassword } from "@repo/auth/password";

const ARGON2_PREFIX = "$argon2";
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1"];

const connectionUrl = process.env.DATABASE_URL;
if (!connectionUrl) {
    console.error("DATABASE_URL が設定されていません。packages/api/.env を確認してください。");
    process.exit(1);
}

let hostname;
try {
    hostname = new URL(connectionUrl).hostname;
} catch {
    console.error("DATABASE_URL を URL として解釈できませんでした。");
    process.exit(1);
}

const isLocalDatabase = LOCAL_HOSTNAMES.includes(hostname);
const isExplicitlyAllowed = process.env.ALLOW_REMOTE_PASSWORD_HASHING === "1";

if (!isLocalDatabase && !isExplicitlyAllowed) {
    console.error(
        [
            "",
            `接続先がローカル DB ではありません: ${hostname}`,
            "このスクリプトは全ユーザーのパスワードを書き換えるため、実行を中止しました。",
            "",
            "本番への適用は #287（API の Vercel 統合）の切り替えと同時に行ってください。",
            "それより前に適用すると render-legacy の平文照合が通らなくなります。",
            "",
            "意図どおりであれば",
            "  ALLOW_REMOTE_PASSWORD_HASHING=1 node scripts/hash-existing-passwords.mjs",
            "として再実行してください。",
            "",
        ].join("\n")
    );
    process.exit(1);
}

if (!isLocalDatabase) {
    console.warn(`[警告] リモート DB (${hostname}) に対して実行します。`);
}

// パスワードもハッシュも出力しない。件数のみを報告する。
const hashPlaintextRows = async (label, findMany, updateById) => {
    const rows = await findMany();
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
        if (row.password.startsWith(ARGON2_PREFIX)) {
            skippedCount += 1;
            continue;
        }
        await updateById(row.id, await hashPassword(row.password));
        updatedCount += 1;
    }

    console.log(`${label}: ハッシュ化 ${updatedCount} 件 / 変換済みのため据え置き ${skippedCount} 件`);
};

await hashPlaintextRows(
    "doctors",
    () => prisma.doctors.findMany({ select: { id: true, password: true } }),
    (id, password) => prisma.doctors.update({ where: { id }, data: { password } })
);

await hashPlaintextRows(
    "patients",
    () => prisma.patients.findMany({ select: { id: true, password: true } }),
    (id, password) => prisma.patients.update({ where: { id }, data: { password } })
);

await prisma.$disconnect();
