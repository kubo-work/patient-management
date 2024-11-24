import { verifyAuthToken } from "../verifyAuthToken.js";
import { Request, Response, Router } from "express";
import { DoctorType } from "../../../common/types/DoctorType";
import { prisma } from "../prisma.js";

const router = Router();

router.get("/", verifyAuthToken, async (_, response: Response) => {
    try {
        const allDoctors: DoctorType[] = await prisma.doctors.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                password: true
            },
            orderBy: {
                id: "asc"
            }
        });
        return response.json(allDoctors);
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

// 医者データ取得
router.get("/:doctor_id", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const doctor_id = Number(request.params.doctor_id)
        const doctor: DoctorType = await prisma.doctors.findFirst({
            select: {
                id: true,
                name: true,
                email: true,
                password: true
            },
            where: { id: doctor_id },
        });
        return response.json(doctor)
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

type PutRequestDoctorType = Omit<DoctorType, "id">

// 医者データ更新
router.put("/:doctor_id", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const doctor_id = Number(request.params.doctor_id)
        const { name, email, password }: PutRequestDoctorType = request.body;
        const updated_at: Date = new Date();
        const result = await prisma.doctors.update({
            where: { id: doctor_id },
            data: {
                name,
                email,
                updated_at,
                password
            },
        });
        return response.json(result)
    } catch (e) {
        return response.status(400).json({ error: "データの更新に失敗しました。" });
    }
})

// 医者データ新規作成
router.post("/", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const { name, email, password }: DoctorType = request.body;
        const result = await prisma.doctors.create({
            data: {
                name,
                email,
                password
            },
        });
        return response.json({ data: result })
    } catch (e) {
        return response.status(400).json({ error: "データの保存に失敗しました。" });
    }
})

export default router;
