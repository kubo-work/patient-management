// 医師のログイン Cookie の属性を 1 箇所に集約する。
// 発行（doctor/login.ts）と削除（doctor/logout.ts, middleware/requireDoctor.ts）で
// 属性が食い違うと、ブラウザは別の Cookie とみなして削除が効かない。
// 3 箇所が同じ定義を参照することで、片方だけ変更されることを防ぐ。

const isProduction = process.env.NODE_ENV === "production";

// Express の res.cookie はミリ秒を受け取るが、Hono の setCookie は秒を受け取る。
// 取り違えると有効期限が 1000 倍ずれ、しかもテストでは検出できないため、
// 単位を名前に含めて次に触る人が気づけるようにする。
export const DOCTOR_COOKIE_MAX_AGE_SECONDS = 60 * 60;

// 三項演算子の結果は注釈が無いと string へ広がり、Hono の CookieOptions に
// 代入できない。as を増やさずに literal を保つため変数の型で受ける。
const doctorCookieSameSite: "None" | "Strict" = isProduction ? "None" : "Strict";

// path: Express は "/" を自動補完したが Hono は補完しない。省略すると Path が
//       /doctor になり、他のパスへ Cookie が送られなくなる。
// domain: 本番はフロントと API のドメインが異なるため必要。削除時にも同じ値を
//       渡さなければ Cookie は消えない。
export const doctorCookieAttributes = {
    httpOnly: true,
    secure: isProduction,
    sameSite: doctorCookieSameSite,
    path: "/",
    ...(isProduction && { domain: process.env.SERVER_DOMAIN }),
};
