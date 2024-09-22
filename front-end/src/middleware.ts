import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
    // クッキーからセッション情報を取得
    if (req.nextUrl.pathname.startsWith("/doctor")) {
        const session = req.cookies.get("doctor-management");
        if (req.nextUrl.pathname !== "/doctor/login") {
            if (!session) {
                return NextResponse.redirect(new URL('/doctor/login', req.url));
            } else {
                return NextResponse.next();
            }
        }
    }
}
