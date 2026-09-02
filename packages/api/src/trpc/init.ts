import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.js";

// superjson を入れる理由は ADR 0003 決定 6。transformer が無いと
// tRPC はサーバの戻り値の型をそのまま推論するため、型は Date を主張して
// 実行時は文字列という食い違いが残る。型安全が目的の変更で嘘を作らない。
const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

// Cookie 無し（401）と検証失敗（403）の 2 分岐。
// ADR 0003 の時点では「秘密鍵未設定」を加えた 3 分岐だったが、@repo/auth が
// 読み込み時に throw するようになり到達不能になったため畳んだ（ADR 0004 決定 3）。
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (ctx.doctorAuth === null) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインしてください。" });
    }
    if (!ctx.doctorAuth.ok) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "ログインの有効期限が切れている可能性があります。",
        });
    }
    // 通過後は doctorId が number として推論される
    return next({ ctx: { ...ctx, doctorId: ctx.doctorAuth.doctorId } });
});
