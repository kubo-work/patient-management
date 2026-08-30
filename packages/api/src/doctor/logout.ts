import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { doctorCookieName } from "@repo/schema";

const router = new Hono();

router.post("/", async (context) => {
    deleteCookie(context, doctorCookieName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Strict",
        // 発行時と同じ path でなければ削除されない。login.ts の setCookie と揃える。
        path: "/",
        ...(process.env.NODE_ENV === "production" && { domain: process.env.SERVER_DOMAIN })
    });

    // express-session のセッション破棄はここにあったが、sessionId / userId に
    // 値を書き込むコードがリポジトリ内に存在せず、常に空のセッションを
    // 破棄していただけだった。レスポンスは従来と同じ。
    return context.text('ログアウトしました。');
});

export default router;
