import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie } from "hono/cookie";
import { doctorCookieName } from "@repo/schema";
import { doctorCookieAttributes } from "../doctor_cookie.js";
import { verifyDoctorToken } from "../auth/token.js";

// このミドルウェアを通過したハンドラでは context.get("doctorId") が number として
// 推論される。Express 時代は declare module による Request の拡張だったため
// 全リクエストで optional になり、到達不能な null チェックが必要だった。
export type DoctorAuthVariables = {
    doctorId: number;
};

export const requireDoctor = createMiddleware<{ Variables: DoctorAuthVariables }>(
    async (context, next) => {
        const token = getCookie(context, doctorCookieName);
        if (!token) {
            return context.json({ error: "ログインしてください。" }, 401);
        }

        // JWT の検証は auth/token.ts に集約している。移行中は tRPC の
        // protectedProcedure も同じ関数を使うため、片方だけ直る事故を防ぐ。
        const result = verifyDoctorToken(token);
        if (!result.ok) {
            if (result.reason === "secret-missing") {
                // 発行時と同じ属性を渡さなければ削除されない。path だけでは本番で
                // domain が一致せず Cookie が残る。
                deleteCookie(context, doctorCookieName, doctorCookieAttributes);
                return context.json({ error: "トークンの設定が無効です。" }, 401);
            }
            return context.json(
                { error: "ログインの有効期限が切れている可能性があります。" },
                403
            );
        }

        context.set("doctorId", result.doctorId);
        await next();
    }
);
