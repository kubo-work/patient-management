import express from "express";
import type { Express, Request, Response } from "express";
import { PrismaClient } from "@prisma/client"
import cors from "cors";
import { DoctorType } from "../../common/types/DoctorType";
import { PatientType } from "../../common/types/PatientType";

// SessionDataに独自の型を生やす
declare module 'express-session' {
    interface SessionData {
        sessionId?: string;
        userId?: number
    }
}

const { v4: uuidv4 } = require('uuid');  // uuidライブラリからv4 UUIDを使う

const app: Express = express();
const PORT: number = 8080;
const session = require('express-session');
const sessionName = "doctor-management";

const ACCESS_CLIENT_URL: string = process.env.CLIENT_URL;
app.use(express.json())
app.use(cors({
    origin: ACCESS_CLIENT_URL,
    optionsSuccessStatus: 200,
    credentials: true
}))

app.use(session({
    secret: process.env.DOCTOR_SESSION_SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    name: sessionName,
    cookie: {
        secure: false, // HTTPSを使用
        httpOnly: true, // XSS攻撃を防ぐ
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // セッションの有効期限を設定（例: 24時間）
    }
}))

app.post("/doctor/login", async (req: Request, res: Response) => {
    try {
        const email: string = req.body.email;
        const password: string = req.body.password;

        if (!email) {
            return res.status(400).json({ error: "メールアドレスが入力されていません。" })
        }

        if (!password) {
            return res.status(400).json({ error: "パスワードが入力されていません。" })
        }
        const doctor: DoctorType = await prisma.doctors.findFirst({
            where: {
                AND: [
                    { email }, { password }
                ]
            }
        })
        if (!doctor) {
            return res.status(401).json({ error: "無効なメールアドレスまたはパスワードです。" });
        }

        const sessionUUID = uuidv4();
        req.session.sessionId = sessionUUID;  // UUIDをセッションIDとして保存
        req.session.userId = doctor.id; // 実際のデータベースIDも必要に応じて保存

        return res.json({
            message: "ログインに成功しました。",
            sessionId: sessionUUID,  // UUIDをクライアントに返す（通常は必要ないが、場合によっては返す）
            doctor: {
                id: doctor.id, // クライアント側で必要な情報だけを返す
                name: doctor.name,
                email: doctor.email
            }
        });
    } catch (e) {
        return res.status(400).json(e)
    }
})

app.post("/doctor/logout", async (req: Request, res: Response) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to log out' });
        }
        res.clearCookie(sessionName);  // クッキーの削除
        res.json({ message: 'Logout successful' });
    });
});

app.get("/patients", async (req: Request, res: Response) => {
    if (!req.session) {
        return res.status(401).json({ error: "不正なアクセスです。" })
    }
    try {
        const allPatients: PatientType[] = await prisma.patients.findMany();
        return res.json(allPatients)
    } catch (e) {
        return res.status(400).json({ error: "データの取得に失敗しました。" })
    }
})

const prisma = new PrismaClient();

app.listen(PORT, () => console.log("server is running"))
