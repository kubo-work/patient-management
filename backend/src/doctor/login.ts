import { Request, Response, Router } from "express";
import { DoctorType } from "../../../common/types/DoctorType.js";
import { prisma } from "../prisma.js";
import jwt from 'jsonwebtoken';
const { sign } = jwt;

const router = Router();
router.post("/", async (request: Request, response: Response) => {
    try {
        const { email, password }: { email: string; password: string } = request.body;

        if (!email) {
            return response.status(400).json({ error: "メールアドレスが入力されていません。" })
        }

        if (!password) {
            return response.status(400).json({ error: "パスワードが入力されていません。" })
        }
        const doctor: DoctorType = await prisma.doctors.findFirst({
            where: {
                AND: [
                    { email }, { password }
                ]
            }
        })
        if (!doctor) {
            return response.status(401).json({ error: "無効なメールアドレスまたはパスワードです。" });
        }

        const sessionID = request.sessionID;
        const userId = doctor.id;
        const token = sign({ userId, email }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });
        return response.json({
            message: "ログインに成功しました。",
            sessionId: sessionID,
            token
        });
    } catch (e) {
        return response.status(400).json(e);
    }
})

export default router;
