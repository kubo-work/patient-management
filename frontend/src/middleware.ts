import { NextRequest, NextResponse } from "next/server";
import { doctorCookieName } from "../../common/util/CookieName";

export function middleware(req: NextRequest) {
    const url = req.nextUrl;

    if (url.pathname.startsWith("/doctor")) {
        const cookieHeader = req.headers.get("cookie");
        // httpOnlyのクッキーは取得できないので注意
        const cookie = cookieHeader?.split("; ").find(c => c.startsWith(`${doctorCookieName}=`))?.split("=")[1];

        if (!cookie && url.pathname !== "/doctor/login") {
            return NextResponse.redirect(new URL("/doctor/login", req.url));
        }
        if (cookie && url.pathname === "/doctor/login") {
            return NextResponse.redirect(new URL("/doctor/patients-list", req.url));
        }
    }
    return NextResponse.next();
}
