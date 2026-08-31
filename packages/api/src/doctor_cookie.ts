// 医師のログイン Cookie の属性を 1 箇所に集約する。
// 発行と削除の両方を行う router/auth.ts（login / logout）と、
// 削除のみを行う trpc/init.ts（protectedProcedure の未認可時の削除）の
// 2 箇所が参照する。発行時と削除時で属性が食い違うと、ブラウザは別の
// Cookie とみなし削除が効かなくなるため、同じ定義を共有することで防ぐ。

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
