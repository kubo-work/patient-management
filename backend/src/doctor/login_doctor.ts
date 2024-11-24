import { Request, Response, Router } from "express";
import { prisma } from "../prisma.js";
import { verifyAuthToken } from "../verifyAuthToken.js";
import { DoctorType } from "../../../common/types/DoctorType";

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
        return response.json(doctor)
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
});

export default router;
