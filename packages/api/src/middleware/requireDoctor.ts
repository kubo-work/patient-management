import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie } from "hono/cookie";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { secretKey } from "../jwt_secret_key.js";
import { doctorCookieName } from "@repo/schema";
import { doctorCookieAttributes } from "../doctor_cookie.js";

const { verify } = jwt;

// このミドルウェアを通過したハンドラでは context.get("doctorId") が number として
// 推論される。Express 時代は declare module による Request の拡張だったため
// 全リクエストで optional になり、到達不能な null チェックが必要だった。
export type DoctorAuthVariables = {
    doctorId: number;
};

interface CustomJwtPayload extends JwtPayload {
    userId: string; // JWT のペイロードに userId を持たせている
}

export const requireDoctor = createMiddleware<{ Variables: DoctorAuthVariables }>(
    async (context, next) => {
        const token = getCookie(context, doctorCookieName);
        if (!token) {
            return context.json({ error: "ログインしてください。" }, 401);
        }

        if (!secretKey) {
            // 発行時と同じ属性を渡さなければ削除されない。path だけでは本番で
            // domain が一致せず Cookie が残る。
            deleteCookie(context, doctorCookieName, doctorCookieAttributes);
            return context.json({ error: "トークンの設定が無効です。" }, 401);
        }

        try {
            const decoded = verify(token, secretKey);
            if (typeof decoded !== "object") {
                throw new TypeError("JWT のペイロードがオブジェクトではありません。");
            }
            context.set("doctorId", Number((decoded as CustomJwtPayload).userId));
        } catch {
            return context.json(
                { error: "ログインの有効期限が切れている可能性があります。" },
                403
            );
        }

        // next() は try の外で呼ぶ。中に入れると下流のハンドラが投げた例外まで
        // 認可失敗として 403 にしてしまう。
        await next();
    }
);
