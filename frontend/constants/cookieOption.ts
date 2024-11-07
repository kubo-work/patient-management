import { CookieOptions } from "../../common/types/CookieOptions";

const cookieOptions: CookieOptions = {
    maxAge: 24 * 60 * 60 * 1000,
    path: '/doctor',
    secure: process.env.NEXT_DOCTOR_SESSION_SECURE === 'true',
    httpOnly: false,
}

export const doctorCookieOptions: CookieOptions = cookieOptions
