import { verifyAuthToken } from "../verifyAuthToken.js";
import { Request, Response, Router } from "express";
import { DoctorType } from "../../../common/types/DoctorType";
import { prisma } from "../prisma.js";
import { z } from "zod";

const getDoctorSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    password: z.string(),
});

const getDoctorsSchema = z.array(getDoctorSchema);

const createDoctorSchemaObject = {
    name: z.string(),
    email: z.string(),
    password: z.string(),
}

const updateDoctorSchemaObject = {
    ...createDoctorSchemaObject,
    updated_at: z.date()
}

const updateDoctorSchema = z.object(updateDoctorSchemaObject);

const createDoctorSchema = z.object(createDoctorSchemaObject);

type GetDoctor = z.infer<typeof getDoctorSchema>;
type CreateDoctor = z.infer<typeof createDoctorSchema>;
type UpdateDoctor = z.infer<typeof updateDoctorSchema>;

const router = Router();

router.get("/", verifyAuthToken, async (_, response: Response) => {
    try {
        const allDoctors: DoctorType[] = await prisma.doctors.findMany({
            orderBy: {
                id: "asc"
            }
        });
        const parseDoctors: GetDoctor[] = getDoctorsSchema.parse(allDoctors);
        return response.json(parseDoctors);
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

// 医者データ取得
router.get("/:doctor_id", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const doctor_id = Number(request.params.doctor_id)
        const doctor: DoctorType = await prisma.doctors.findFirst({
            where: { id: doctor_id },
        });
        const parseDoctor: GetDoctor = getDoctorSchema.parse(doctor);
        return response.json(parseDoctor)
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

        const validatedData: UpdateDoctor = updateDoctorSchema.parse({ name, email, password, updated_at });
        const result = await prisma.doctors.update({
            where: { id: doctor_id },
            data: validatedData
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
        const validatedData: CreateDoctor = createDoctorSchema.parse({ name, email, password });
        const result = await prisma.doctors.create({
            data: {
                name: validatedData.name,
                email: validatedData.email,
                password: validatedData.password
            },
        });
        return response.json({ data: result })
    } catch (e) {
        return response.status(400).json({ error: "データの保存に失敗しました。" });
    }
})

export default router;
