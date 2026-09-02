import type { Context as HonoContext } from "hono";
import { getCookie } from "hono/cookie";
import { doctorCookieName } from "@repo/schema";
import { verifyDoctorToken, type DoctorTokenResult } from "@repo/auth";

// Hono の Context を持ち回るのは、login / logout が setCookie / deleteCookie を
// 呼ぶ必要があるため。tRPC 自体は Cookie を扱う手段を持たない。
//
// doctorAuth が null なのは「Cookie そのものが無い」場合。検証まで進んだ結果は
// DoctorTokenResult に入る。この 2 状態が protectedProcedure の 401 と 403 に対応する。
export type TrpcContext = {
    honoContext: HonoContext;
    doctorAuth: DoctorTokenResult | null;
};

// jose の検証が非同期のため createTrpcContext も非同期になる（ADR 0004 決定 1）。
// @hono/trpc-server の createContext は Promise を受け付けるため app.ts に変更は要らない。
export const createTrpcContext = async (honoContext: HonoContext): Promise<TrpcContext> => {
    const token = getCookie(honoContext, doctorCookieName);
    return {
        honoContext,
        doctorAuth: token ? await verifyDoctorToken(token) : null,
    };
};
