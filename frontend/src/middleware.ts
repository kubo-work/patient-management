import { NextRequest, NextResponse } from "next/server";
import { doctorCookieName } from "../../common/util/CookieName";

export function middleware(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith("/doctor")) {
        // 何故か getCookie のオブジェクトの中身の変数を request と書くとエラーになるので req にする
        const cookie = req.cookies.get(doctorCookieName)?.value;
        if (req.nextUrl.pathname !== "/doctor/login") {
            if (!cookie) {
                return NextResponse.redirect(new URL('/doctor/login', req.url));
            }
        } else {
            if (cookie) {
                return NextResponse.redirect(new URL('/doctor/patients-list', req.url));
            }
        }
    }
    return NextResponse.next();
}

