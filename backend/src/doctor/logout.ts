import { Request, Response, Router } from "express";
import { sessionName } from "../index.js";
import { doctorCookieName } from "../../../common/util/CookieName.js";

const router = Router();
router.post("/", async (request: Request, response: Response) => {
    response.clearCookie(doctorCookieName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        ...(process.env.NODE_ENV === "production" && { domain: process.env.SERVER_DOMAIN })
    });

    // express-sessionのセッションを破棄
    if (request.session) {
        request.session.destroy(err => {
            if (err) {
                console.error('Failed to destroy session:', err);
                response.status(500).send('ログアウトに失敗しました。');
            } else {
                response.clearCookie(sessionName);
                response.send('ログアウトしました。');
            }
        });
    } else {
        // セッションがなくてもJWTクッキーは削除済み
        response.send('ログアウトしました。');
    }
});

export default router;
