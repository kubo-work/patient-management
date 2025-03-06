import { Request, Response, Router } from "express";
import { sessionName } from "../index.js";
import { doctorCookieName } from "../../../common/util/CookieName.js";

const router = Router();
router.post("/", async (request: Request, response: Response) => {
    if (request.session) {
        request.session.destroy(err => {
            if (err) {
                console.error('Failed to destroy session:', err);
                response.status(500).send('ログアウトに失敗しました。');
            } else {
                response.clearCookie(sessionName); // クッキーの名前に合わせて指定
                response.clearCookie(doctorCookieName);
                response.send('ログアウトしました。');
            }
        });
    } else {
        response.status(400).send('ログインしていません。');
    }
});

export default router;
