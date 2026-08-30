import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { deleteCookie } from "hono/cookie";
import { doctorCookieName } from "@repo/schema";
import { doctorCookieAttributes } from "../doctor_cookie.js";
import type { TrpcContext } from "./context.js";

// superjson を入れる理由は ADR 0003 決定 6。transformer が無いと
// tRPC はサーバの戻り値の型をそのまま推論するため、型は Date を主張して
// 実行時は文字列という食い違いが残る。型安全が目的の変更で嘘を作らない。
const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

// REST の requireDoctor と同じ 3 分岐を再現する。潰すと振る舞いが変わる。
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.doctorAuth === null) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインしてください。" });
    }
    if (!ctx.doctorAuth.ok) {
        if (ctx.doctorAuth.reason === "secret-missing") {
            deleteCookie(ctx.honoContext, doctorCookieName, doctorCookieAttributes);
            throw new TRPCError({ code: "UNAUTHORIZED", message: "トークンの設定が無効です。" });
        }
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "ログインの有効期限が切れている可能性があります。",
        });
    }
    // 通過後は doctorId が number として推論される
    return next({ ctx: { ...ctx, doctorId: ctx.doctorAuth.doctorId } });
});
