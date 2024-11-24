import { verifyAuthToken } from "../verifyAuthToken.js";
import { Response, Router } from "express";

const router = Router();

router.get("/", verifyAuthToken, (_, response: Response) => {
    return response.json([{ success: "認証に成功しました。" }]);
})

export default router
