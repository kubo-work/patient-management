import { verifyAuthToken } from "../verifyAuthToken.js";
import { Request, Response, Router } from "express";
import { DoctorType } from "../../../common/types/DoctorType";
import { prisma } from "../prisma.js";
import { z, ZodError } from "zod";

const baseDoctorSchema = {
    name: z.string(),
    email: z.string(),
    password: z.string(),
}

const getDoctorSchema = z.object({
    ...baseDoctorSchema,
    id: z.number(),
});

const getDoctorsSchema = z.array(getDoctorSchema);

const updateDoctorSchemaObject = {
    ...baseDoctorSchema,
    updated_at: z.date()
}

const createDoctorSchema = z.object(baseDoctorSchema);
const updateDoctorSchema = z.object(updateDoctorSchemaObject);

type GetDoctorSchema = z.infer<typeof getDoctorSchema>;
type CreateDoctorSchema = z.infer<typeof createDoctorSchema>;
type UpdateDoctorSchema = z.infer<typeof updateDoctorSchema>;

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
        const parseDoctors: GetDoctorSchema[] = getDoctorsSchema.parse(allDoctors);
        return response.json(parseDoctors);
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

// 医者データ取得
router.get("/:doctor_id", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const doctor_id = Number(request.params.doctor_id)
        const doctor: DoctorType | null = await prisma.doctors.findFirst({
            select: {
                id: true,
                name: true,
                email: true,
                password: true
            },
            where: { id: doctor_id },
        });
        if (!doctor) {
            return response.status(404).json({ error: "指定された医師が見つかりません。" });
        }
        const parseDoctor: GetDoctorSchema = getDoctorSchema.parse(doctor);
        return response.json(parseDoctor)
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

type PutRequestDoctorType = Omit<DoctorType, "id">

// 医者データ更新
router.put("/:doctor_id", async (request: Request, response: Response) => {
    try {
        const doctor_id = Number(request.params.doctor_id)
        const { name, email, password }: PutRequestDoctorType = request.body;
        const updated_at: Date = new Date();

        const parsedData: {
            success: true;
            data: UpdateDoctorSchema;
        } | {
            success: false;
            error: ZodError;
        } = updateDoctorSchema.safeParse({ name, email, password, updated_at });
        if (!parsedData.success) {
            return response.status(400).json({
                error: "入力データが不正です。",
            });
        }
        const result = await prisma.doctors.update({
            where: { id: doctor_id },
            data: parsedData.data
        });
        return response.json(result)
    } catch (e) {
        if (e.code === "P2025") {
            return response.status(404).json({ error: "指定された医師が見つかりません。" });
        } else {
            return response.status(400).json({ error: "データの更新に失敗しました。" });
        }
    }
})

// 医者データ新規作成
router.post("/", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const { name, email, password }: DoctorType = request.body;
        const parsedData: {
            success: true;
            data: CreateDoctorSchema;
        } | {
            success: false;
            error: ZodError;
        } = createDoctorSchema.safeParse({ name, email, password });
        if (!parsedData.success) {
            return response.status(400).json({
                error: "入力データが不正です。",
            });
        }
        const result = await prisma.doctors.create({
            data: parsedData.data
        });
        return response.json({ data: result })
    } catch (e) {
        return response.status(400).json({ error: "データの保存に失敗しました。" });
    }
})

export default router;
