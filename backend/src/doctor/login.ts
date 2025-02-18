import { Request, Response, Router } from "express";
import { DoctorType } from "../../../common/types/DoctorType.js";
import { prisma } from "../prisma.js";
import jwt from 'jsonwebtoken';
import { secretKey } from "../jwt_secret_key.js";
import { z } from "zod";
const { sign } = jwt;

const getDoctorSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    password: z.string(),
});

type GetDoctorSchema = z.infer<typeof getDoctorSchema>;

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
        const doctor: DoctorType | null = await prisma.doctors.findFirst({
            where: {
                AND: [
                    { email }, { password }
                ]
            }
        })
        if (!doctor) {
            return response.status(401).json({ error: "無効なメールアドレスまたはパスワードです。" });
        }

        const parseDoctor: GetDoctorSchema = getDoctorSchema.parse(doctor);
        const sessionID = request.sessionID;
        const userId = doctor.id;
        if (!secretKey) {
            return response.status(401).json({ error: "トークンの設定が無効です。" });
        }
        const token = sign({ userId, email }, secretKey, { expiresIn: "1d" });
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
