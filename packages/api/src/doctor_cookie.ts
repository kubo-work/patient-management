// 医師のログイン Cookie の属性を 1 箇所に集約する。
// 発行と削除の両方を行う router/auth.ts（login / logout）が参照する。
// 発行時と削除時で属性が食い違うと、ブラウザは別の Cookie とみなし削除が
// 効かなくなるため、同じ定義を共有することで防ぐ。

const isProduction = process.env.NODE_ENV === "production";

// Express の res.cookie はミリ秒を受け取るが、Hono の setCookie は秒を受け取る。
// 取り違えると有効期限が 1000 倍ずれ、しかもテストでは検出できないため、
// 単位を名前に含めて次に触る人が気づけるようにする。
export const DOCTOR_COOKIE_MAX_AGE_SECONDS = 60 * 60;

// SameSite はオリジンではなくサイト（eTLD+1）で判定される。フロントの www と
// API の api は同じ eTLD+1 に属するため same-site であり、Lax でも Cookie は
// 送信される（ADR 0006 決定 5）。
//
// 移行前は API が onrender.com にあり cross-site だったため None 以外に
// 選択肢が無かった。None はクロスサイト送信を許す最も弱い設定で、CSRF 耐性を
// ブラウザ側の既定防御に頼れなくなる。api サブドメインへ移った時点で不要になる。
//
// 三項演算子の結果は注釈が無いと string へ広がり、Hono の CookieOptions に
// 代入できない。as を増やさずに literal を保つため変数の型で受ける。
const doctorCookieSameSite: "Lax" | "Strict" = isProduction ? "Lax" : "Strict";

// path: Express は "/" を自動補完したが Hono は補完しない。省略すると Path が
//       /doctor になり、他のパスへ Cookie が送られなくなる。
// domain: www 側の proxy.ts が Cookie を読んで画面遷移を判定するため必要
//       （ADR 0004 決定 4）。api ホスト限定の host-only Cookie では読めない。
//       削除時にも同じ値を渡さなければ Cookie は消えない。
export const doctorCookieAttributes = {
    httpOnly: true,
    secure: isProduction,
    sameSite: doctorCookieSameSite,
    path: "/",
    ...(isProduction && { domain: process.env.SERVER_DOMAIN }),
};
