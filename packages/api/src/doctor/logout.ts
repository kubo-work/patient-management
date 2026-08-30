import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { doctorCookieName } from "@repo/schema";
import { doctorCookieAttributes } from "../doctor_cookie.js";

const router = new Hono();

router.post("/", async (context) => {
    deleteCookie(context, doctorCookieName, doctorCookieAttributes);

    // express-session のセッション破棄はここにあったが、sessionId / userId に
    // 値を書き込むコードがリポジトリ内に存在せず、常に空のセッションを
    // 破棄していただけだった。レスポンスは従来と同じ。
    return context.text('ログアウトしました。');
});

export default router;
