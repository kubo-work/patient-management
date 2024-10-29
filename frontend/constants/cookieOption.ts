export const doctorCookieOptions: { maxAge: number, path: string, secure: boolean, httpOnly: boolean, sameSite: boolean | "none" | "lax" | "strict" | undefined } = {
    maxAge: 24 * 60 * 60 * 1000,
    path: '/doctor',
    secure: process.env.NEXT_DOCTOR_SESSION_SECURE === 'true', // HTTPSでのみ送信
    httpOnly: false,
    sameSite: 'lax'
}
