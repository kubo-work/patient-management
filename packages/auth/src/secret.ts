// JWT_SECRET_KEY が無い状態を実行時まで持ち越さない（ADR 0004 決定 3）。
// packages/api/src/app.ts の CLIENT_URL、@repo/db の DATABASE_URL と同じ扱いで、
// 設定漏れを読み込み時点で落とす。
//
// 検証できないまま素通しする案と、検証できないので全員を弾く案はどちらも
// 「壊れていることが分からない壊れ方」になるため採らなかった。
const rawSecret = process.env.JWT_SECRET_KEY;

if (!rawSecret) {
    throw new Error(
        "JWT_SECRET_KEY が設定されていません。医師トークンの署名と検証に使用します。"
    );
}

// jose は鍵を Uint8Array で受け取る。読み込み時に 1 度だけ変換する。
export const doctorTokenSecret: Uint8Array = new TextEncoder().encode(rawSecret);
