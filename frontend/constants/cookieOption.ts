export const doctorCookieOptions: { path: string, secure: boolean, httpOnly: boolean } = {
    path: '/doctor',
    secure: process.env.NEXT_DOCTOR_SESSION_SECURE === 'true', // HTTPSでのみ送信
    httpOnly: false,
}
