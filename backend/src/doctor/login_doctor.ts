import { Request, Response, Router } from "express";
import { prisma } from "../prisma.js";
import { verifyAuthToken } from "../verifyAuthToken.js";
import { DoctorType } from "../../../common/types/DoctorType";
import { z } from "zod";

const getDoctorSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    password: z.string(),
});

type GetDoctorSchema = z.infer<typeof getDoctorSchema>;

const router = Router();

router.get("/", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        if (!request.user) {
            return response.status(401).json({ error: "医者データのリクエストに失敗しました。" });
        }
        const doctor: DoctorType | null = await prisma.doctors.findFirst({
            select: {
                id: true,
                name: true,
                email: true,
                password: true
            },
            where: {
                AND: [
                    { id: Number(request.user.userId) }
                ]
            }
        })
        // doctor が null の場合
        if (!doctor) {
            return response.status(404).json({ error: "指定された医師が見つかりません。" });
        }
        const parseDoctor: GetDoctorSchema = getDoctorSchema.parse(doctor);
        return response.json(parseDoctor)
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
});

export default router;
