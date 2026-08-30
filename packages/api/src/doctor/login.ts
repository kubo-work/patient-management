import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { DoctorType, doctorCookieName } from "@repo/schema";
import { DOCTOR_COOKIE_MAX_AGE_SECONDS, doctorCookieAttributes } from "../doctor_cookie.js";
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
            ...doctorCookieAttributes,
            maxAge: DOCTOR_COOKIE_MAX_AGE_SECONDS,
        });
        return context.json({
            message: "ログインに成功しました。",
        });
    } catch (e) {
        return context.json({ error: "ログインに失敗しました。" }, 400);
    }
})

export default router;
