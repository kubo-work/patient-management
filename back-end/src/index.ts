import express from "express";
import type { Express, Request, Response } from "express";
import { PrismaClient } from "@prisma/client"
import cors from "cors";
import { error } from "console";

const app: Express = express();
const PORT: number = 8080;

const ACCESS_CLIENT_URL: string = process.env.CLIENT_URL;
app.use(express.json())
app.use(cors({
    origin: ACCESS_CLIENT_URL,
    optionsSuccessStatus: 200
}))

app.get("/doctor/:email/:password", async (req: Request, res: Response) => {
    try {
        const email: string = req.params.email;
        const password: string = req.params.password;

        if (!email) {
            return res.status(400).json({ error: "メールアドレスが入力されていません。" })
        }

        if (!password) {
            return res.status(400).json({ error: "パスワードが入力されていません。" })
        }
        const doctor = await prisma.doctors.findFirst({
            where: {
                AND: [
                    { email }, { password }
                ]

            }
        })
        return res.json(doctor)
    } catch (e) {
        return res.status(400).json(e)
    }
})

app.get("/patients", async (req: Request, res: Response) => {
    try {
        const allPatients = await prisma.patients.findMany();
        return res.json(allPatients)
    } catch (e) {
        console.error(e);
        return res.status(400).json({ error: "データの取得に失敗しました。" })
    }
})

const prisma = new PrismaClient();

app.listen(PORT, () => console.log("server is running"))
