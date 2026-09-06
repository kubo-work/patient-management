// 指定した医師のパスワードを、新しい値の argon2id ハッシュで上書きする。
//
// パスワードをハッシュ化した結果（ADR 0005）、DB からは元のパスワードを
// 読み出せなくなった。忘れた本人に元の値を教えることはできないため、
// 「復旧」は新しい値で上書きすることを指す。
//
// 使い方:
//   cd packages/api
//   bun run reset-password -- doctor@example.com
//
// 新しいパスワードは標準入力から読む。引数で渡すと shell の履歴と
// プロセス一覧に残るため受け付けない。入力はエコーしない。
//
// このスクリプトはロール導入時のブートストラップでも使う。最初の管理者を
// 作るには DB を直接触るしかない（管理者を作る画面を使うには、先に管理者が
// 必要になるため）。
import { createInterface } from "node:readline";
import { prisma } from "@repo/db";
import { hashPassword } from "@repo/auth/password";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1"];

const email = process.argv[2];
if (!email) {
    console.error("医師のメールアドレスを指定してください（例: bun run reset-password -- doctor@example.com）。");
    process.exit(1);
}

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
if (!isLocalDatabase && process.env.ALLOW_REMOTE_PASSWORD_RESET !== "1") {
    console.error(
        [
            "",
            `接続先がローカル DB ではありません: ${hostname}`,
            "このスクリプトは医師のパスワードを書き換えるため、実行を中止しました。",
            "",
            "本番のアカウントを復旧する意図であれば",
            "  ALLOW_REMOTE_PASSWORD_RESET=1 bun run reset-password -- <メールアドレス>",
            "として再実行してください。",
            "",
        ].join("\n")
    );
    process.exit(1);
}

// 対象が存在しない場合に入力を求めない。存在しないアカウントへ向けて
// パスワードを打たせても意味がなく、打った値だけが手元に残る。
const doctor = await prisma.doctors.findFirst({
    where: { email },
    select: { id: true, name: true },
});
if (!doctor) {
    console.error(`該当する医師が見つかりません: ${email}`);
    await prisma.$disconnect();
    process.exit(1);
}

if (!isLocalDatabase) {
    console.warn(`[警告] リモート DB (${hostname}) の「${doctor.name}」を更新します。`);
}

// エコーせずに 1 行読む。readline の既定は入力をそのまま表示するため、
// output を渡さないことで表示を止める。
const readPasswordWithoutEcho = (promptText) =>
    new Promise((resolve) => {
        process.stdout.write(promptText);
        const reader = createInterface({ input: process.stdin });
        reader.once("line", (line) => {
            reader.close();
            process.stdout.write("\n");
            resolve(line);
        });
    });

const newPassword = await readPasswordWithoutEcho("新しいパスワード（表示されません）: ");

if (!newPassword) {
    console.error("パスワードが入力されませんでした。更新していません。");
    await prisma.$disconnect();
    process.exit(1);
}

try {
    await prisma.doctors.update({
        where: { id: doctor.id },
        data: { password: await hashPassword(newPassword), updated_at: new Date() },
    });
    // 入力値もハッシュも出力しない。
    console.log(`「${doctor.name}」のパスワードを更新しました。`);
} catch (error) {
    console.error("更新に失敗しました:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
