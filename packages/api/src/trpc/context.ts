import type { Context as HonoContext } from "hono";
import { getCookie } from "hono/cookie";
import { doctorCookieName } from "@repo/schema";
import { verifyDoctorToken, type DoctorTokenResult } from "../auth/token.js";

// Hono の Context を持ち回るのは、login / logout が setCookie / deleteCookie を
// 呼ぶ必要があるため。tRPC 自体は Cookie を扱う手段を持たない。
//
// doctorAuth が null なのは「Cookie そのものが無い」場合。検証まで進んだ結果は
// DoctorTokenResult に入る。この 3 状態が REST の 3 分岐に対応する。
export type TrpcContext = {
    honoContext: HonoContext;
    doctorAuth: DoctorTokenResult | null;
};

export const createTrpcContext = (honoContext: HonoContext): TrpcContext => {
    const token = getCookie(honoContext, doctorCookieName);
    return {
        honoContext,
        doctorAuth: token ? verifyDoctorToken(token) : null,
    };
};
