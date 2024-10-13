import { NextRequest, NextResponse } from "next/server";
import { doctorCookieKeyName } from "../constants/cookieKey";
import { getCookie } from "cookies-next";

export function middleware(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith("/doctor")) {
        const cookie = getCookie(doctorCookieKeyName, { req })
        if (req.nextUrl.pathname !== "/doctor/login") {
            if (!cookie) {
                return NextResponse.redirect(new URL('/doctor/login', req.url));
            }
        } else {
            if (cookie) {
                return NextResponse.redirect(new URL('/doctor/dashboard', req.url));
            }
        }
    }
    return NextResponse.next();
}

