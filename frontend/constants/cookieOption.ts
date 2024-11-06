import { CookieOptions } from "../../common/types/CookieOptions";

const cookieOptions: CookieOptions = {
    maxAge: 24 * 60 * 60 * 1000,
    path: '/doctor',
    secure: process.env.NEXT_DOCTOR_SESSION_SECURE === 'production',
    httpOnly: true,
    sameSite: "lax"
}

if (process.env.NEXT_DOCTOR_SESSION_SECURE === "production") {
    cookieOptions.domain = process.env.NEXT_PUBLIC_API_DOMAIN
}

export const doctorCookieOptions: CookieOptions = cookieOptions
