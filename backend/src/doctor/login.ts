import { Request, Response, Router } from "express";
import { DoctorType } from "../../../common/types/DoctorType.js";
import { prisma } from "../prisma.js";
import jwt from 'jsonwebtoken';
import { secretKey } from "../jwt_secret_key.js";
import { z } from "zod";
import { doctorCookieName } from "../../../common/util/CookieName.js";
import { app } from "../index.js";
import cors from "cors";
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

        const userId = doctor.id;
        if (!secretKey) {
            return response.status(401).json({ error: "トークンの設定が無効です。" });
        }
        const token = sign({ userId, email }, secretKey, { expiresIn: "1d" });
        response.cookie(doctorCookieName, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            maxAge: 1000 * 60 * 60,
            ...(process.env.NODE_ENV === "production" && { domain: process.env.SERVER_DOMAIN })
        });
        app.use(cors({
            origin: process.env.CLIENT_URL,
            optionsSuccessStatus: 200,
            credentials: true,
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'Accept',
                'X-Requested-With',
            ]
        }));
        return response.json({
            message: "ログインに成功しました。",
        });
    } catch (e) {
        return response.status(400).json(e);
    }
})

export default router;
