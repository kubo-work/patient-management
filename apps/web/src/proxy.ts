import { NextRequest, NextResponse } from "next/server";
import { doctorCookieName } from "@repo/schema";
import { verifyDoctorToken } from "@repo/auth";

// Cookie の有無だけを見ていた頃は、期限切れの Cookie を持つ利用者がデッドロックしていた。
// /doctor/login を開こうとしても Cookie があるため patients-list へ飛ばされ、
// patients-list では tRPC が FORBIDDEN を返すため、ログインし直す画面へ到達できない。
// 署名と有効期限まで検証することでこれを解消する（ADR 0004 決定 4）。
//
// 認可の権威は引き続き packages/api の protectedProcedure にある。ここが担うのは
// 画面遷移の判定だけで、tRPC 側の検証を代替するものではない。
export async function proxy(req: NextRequest) {
    const url = req.nextUrl;

    if (!url.pathname.startsWith("/doctor")) {
        return NextResponse.next();
    }

    const token = req.cookies.get(doctorCookieName)?.value;
    const isAuthenticated = token ? (await verifyDoctorToken(token)).ok : false;

    // 検証に失敗した Cookie をここで削除はしない。本番の Cookie は API 側が
    // domain 付きで発行しており（packages/api/src/doctor_cookie.ts）、属性の異なる
    // 削除をブラウザは受け付けない。効かない処理を置かず、再ログインでの上書きに委ねる
    // （ADR 0004 決定 5）。
    if (!isAuthenticated && url.pathname !== "/doctor/login") {
        return NextResponse.redirect(new URL("/doctor/login", req.url));
    }
    if (isAuthenticated && url.pathname === "/doctor/login") {
        return NextResponse.redirect(new URL("/doctor/patients-list", req.url));
    }
    return NextResponse.next();
}
