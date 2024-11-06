export type CookieOptions = {
    secure: boolean;
    httpOnly: boolean;
    sameSite?: "lax" | "none";
    path: string;
    maxAge: number;
    domain?: string;
}
