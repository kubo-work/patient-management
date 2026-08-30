import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { DoctorType, doctorCookieName } from "@repo/schema";
import { prisma } from "@repo/db";
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

const router = new Hono();

router.post("/", async (context) => {
    try {
        const { email, password }: { email: string; password: string } = await context.req.json();

        if (!email) {
            return context.json({ error: "メールアドレスが入力されていません。" }, 400)
        }

        if (!password) {
            return context.json({ error: "パスワードが入力されていません。" }, 400)
        }
        const doctor: DoctorType | null = await prisma.doctors.findFirst({
            where: {
                AND: [
                    { email }, { password }
                ]
            }
        })
        if (!doctor) {
            return context.json({ error: "無効なメールアドレスまたはパスワードです。" }, 401);
        }

        const userId = doctor.id;
        if (!secretKey) {
            return context.json({ error: "トークンの設定が無効です。" }, 401);
        }
        const token = sign({ userId, email }, secretKey, { expiresIn: "1d" });
        setCookie(context, doctorCookieName, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "None" : "Strict",
            // Express の res.cookie はミリ秒だが Hono の setCookie は秒。
            // 従来と同じ 1 時間にするため 60 * 60 を渡す。
            maxAge: 60 * 60,
            // Express は path を自動で "/" にするが Hono は付けない。
            // 省略すると Path が /doctor になり、他のパスへ Cookie が送られなくなる。
            path: "/",
            ...(process.env.NODE_ENV === "production" && { domain: process.env.SERVER_DOMAIN })
        });
        return context.json({
            message: "ログインに成功しました。",
        });
    } catch (e) {
        return context.json({ error: "ログインに失敗しました。" }, 400);
    }
})

export default router;
