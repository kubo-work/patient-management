import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
    // クッキーからセッション情報を取得
    if (
        req.nextUrl.pathname.startsWith('/_next/') || // Next.jsの静的ファイル
        req.nextUrl.pathname.startsWith('/favicon.ico') // favicon.ico
    ) {
        return NextResponse.next();
    }
    if (req.nextUrl.pathname.startsWith("/doctor")) {
        const session = req.cookies.get("doctor-management");
        if (req.nextUrl.pathname !== "/doctor/login") {
            if (!session) {
                return NextResponse.redirect(new URL('/doctor/login', req.url));
            }
        }
    }
    const cookeStore = cookies();
    console.log(cookeStore)
    console.log('Middleware completed for:', req.nextUrl.pathname);
    return NextResponse.next();
}
