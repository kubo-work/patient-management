import { NextRequest, NextResponse } from "next/server";
import { doctorCookieKeyName } from "../constants/cookieKey";
import { getCookie } from "cookies-next";

export function middleware(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith("/doctor")) {
        // 何故か getCookie のオブジェクトの中身の変数を request と書くとエラーになるので req にする
        const cookie = getCookie(doctorCookieKeyName, { req })
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

