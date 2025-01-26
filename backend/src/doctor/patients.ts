import { Request, Response, Router } from "express";
import { PatientType } from "../../../common/types/PatientType";
import { prisma } from "../prisma.js";
import { verifyAuthToken } from "../verifyAuthToken.js";
import dayjs from "dayjs";
import { z } from "zod";
import { sexList } from "../../../common/util/SexList.js";

export const zodEnumFromObjKeys = <K extends string>(
    obj: Record<K, any>,
): z.ZodEnum<[K, ...K[]]> => {
    const [firstKey, ...otherKeys] = Object.keys(obj) as K[];
    if (typeof firstKey !== "string") throw new Error("key is not string");
    return z.enum([firstKey, ...otherKeys]);
};

const basePatientSchemaObject = {
    name: z.string(),
    email: z.string(),
    tel: z.string(),
    sex: zodEnumFromObjKeys(sexList),
    address: z.string(),
    birth: z.date(),
}

const getPatientSchema = z.object({
    ...basePatientSchemaObject,
    id: z.number(),
    birth: z.date(),
});

const getPatientsSchema = z.array(getPatientSchema)

const createPatientSchemaObject = {
    ...basePatientSchemaObject,
    birth: z.string().transform((val) => new Date(val)),
    password: z.string()
}

const updatePatientSchemaObject = {
    ...basePatientSchemaObject,
    birth: z.string().transform((val) => new Date(val)),
    updated_at: z.date()
}

const createPatientSchema = z.object(createPatientSchemaObject);
const updatePatientSchema = z.object(updatePatientSchemaObject);

type GetPatientSchema = z.infer<typeof getPatientSchema>
type CreatePatientSchema = z.infer<typeof createPatientSchema>;
type UpdatePatientSchema = z.infer<typeof updatePatientSchema>;

const router = Router();

// 患者のデータ全件取得
router.get("/", verifyAuthToken, async (_, response: Response) => {
    try {
        const allPatients: PatientType[] = await prisma.patients.findMany();
        const parsePatients: GetPatientSchema[] = getPatientsSchema.parse(allPatients);
        return response.json(parsePatients);
    } catch (e) {

        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
})
// 患者のデータ取得
router.get("/:patient_id", verifyAuthToken
    , async (request: Request, response: Response) => {
        try {
            const patient_id = Number(request.params.patient_id)
            const patient: PatientType | null = await prisma.patients.findFirst({
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
            if (!patient) {
                return response.status(404).json({ error: "指定された患者が見つかりません。" });
            }
            const parsePatient: GetPatientSchema = getPatientSchema.parse(patient);
            return response.json(parsePatient)
        } catch (e) {
            return response.status(400).json({ error: "データの取得に失敗しました。" })
        }
    })

router.put("/:patient_id", verifyAuthToken
    , async (request: Request, response: Response) => {
        try {
            const { id, name, sex, tel, email, address, birth }: PatientType = request.body;
            const updated_at: Date = new Date();
            const validatedData: UpdatePatientSchema = updatePatientSchema.parse({ id, name, sex, tel, email, address, birth, updated_at });
            const result = await prisma.patients.update({
                where: { id },
                data: validatedData
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
            const password = dayjs(birth).format("YYYYMMDD");
            const validatedData: CreatePatientSchema = createPatientSchema.parse({ name, sex, tel, email, address, birth, password });
            const result = await prisma.patients.create({
                data: validatedData
            });
            return response.json(result)
        } catch (e) {
            return response.status(400).json({ error: "データの登録に失敗しました。" })
        }
    })


export default router
