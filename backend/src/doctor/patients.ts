import { Request, Response, Router } from "express";
import { PatientType } from "../../../common/types/PatientType";
import { prisma } from "../prisma.js";
import { verifyAuthToken } from "../verifyAuthToken.js";
import dayjs from "dayjs";

const router = Router();

// 患者のデータ全件取得
router.get("/", verifyAuthToken, async (_, response: Response) => {
    try {
        const allPatients: PatientType[] = await prisma.patients.findMany();
        return response.json(allPatients);
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
})
// 患者のデータ取得
router.get("/:patient_id", verifyAuthToken
    , async (request: Request, response: Response) => {
        try {
            const patient_id = Number(request.params.patient_id)
            const patient: PatientType = await prisma.patients.findFirst({
                select: {
                    id: true,
                    name: true,
                    email: true,
                    tel: true,
                    sex: true,
                    address: true,
                    birth: true
                },
                where: {
                    id: patient_id
                },
                orderBy: {
                    id: "asc"
                }
            });
            return response.json(patient)
        } catch (e) {
            return response.status(400).json({ error: "データの取得に失敗しました。" })
        }
    })

router.put("/:patient_id", verifyAuthToken
    , async (request: Request, response: Response) => {
        try {
            const { id, name, sex, tel, email, address, birth }: PatientType = request.body;
            const updated_at: Date = new Date();
            const result = await prisma.patients.update({
                where: { id },
                data: {
                    name,
                    sex,
                    tel,
                    email,
                    address,
                    birth,
                    updated_at
                },
            });
            return response.json(result)
        } catch (e) {
            return response.status(400).json({ error: "データの更新に失敗しました。" })
        }
    })

// 患者のデータ作成
router.post("/", verifyAuthToken
    , async (request: Request, response: Response) => {
        try {
            const { name, sex, tel, email, address, birth }: PatientType = request.body;
            const updated_at: Date = new Date();
            const password = dayjs(birth).format("YYYYMMDD");
            const result = await prisma.patients.create({
                data: {
                    name,
                    sex,
                    tel,
                    email,
                    address,
                    birth,
                    password,
                    updated_at
                },
            });
            return response.json(result)
        } catch (e) {
            return response.status(400).json({ error: "データの登録に失敗しました。" })
        }
    })


export default router
