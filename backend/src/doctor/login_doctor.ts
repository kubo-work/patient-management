import { Request, Response, Router } from "express";
import { prisma } from "../prisma.js";
import { verifyAuthToken } from "../verifyAuthToken.js";
import { DoctorType } from "../../../common/types/DoctorType";
import { z } from "zod";

const DoctorSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    password: z.string(),
});

type GetDoctor = z.infer<typeof DoctorSchema>;

const router = Router();

router.get("/", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const doctor: DoctorType = await prisma.doctors.findFirst({
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
        const parseDoctor: GetDoctor = DoctorSchema.parse(doctor);
        return response.json(parseDoctor)
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
});

export default router;
