import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie } from "hono/cookie";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { secretKey } from "../jwt_secret_key.js";
import { doctorCookieName } from "@repo/schema";

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
            deleteCookie(context, doctorCookieName);
            return context.json({ error: "トークンの設定が無効です。" }, 401);
        }

        let decodedToken: CustomJwtPayload;
        try {
            const decoded = verify(token, secretKey);
            if (typeof decoded !== "object") {
                throw new TypeError("JWT のペイロードがオブジェクトではありません。");
            }
            decodedToken = decoded as CustomJwtPayload;
        } catch {
            return context.json(
                { error: "ログインの有効期限が切れている可能性があります。" },
                403
            );
        }

        context.set("doctorId", Number(decodedToken.userId));
        await next();
    }
);
