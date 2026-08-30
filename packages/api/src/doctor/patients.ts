import { Hono } from "hono";
import { PatientType, sexList } from "@repo/schema";
import { prisma } from "@repo/db";
import { requireDoctor, type DoctorAuthVariables } from "../middleware/requireDoctor.js";
import dayjs from "dayjs";
import { z } from "zod";

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

const router = new Hono<{ Variables: DoctorAuthVariables }>();

// 患者のデータ全件取得
router.get("/", requireDoctor, async (context) => {
    try {
        const allPatients: PatientType[] = await prisma.patients.findMany();
        const parsePatients: GetPatientSchema[] = getPatientsSchema.parse(allPatients);
        return context.json(parsePatients);
    } catch (e) {
        return context.json({ error: "データの取得に失敗しました。" }, 400);
    }
})

// 患者のデータ取得
router.get("/:patient_id", requireDoctor, async (context) => {
    try {
        const patient_id = Number(context.req.param("patient_id"))
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
            return context.json({ error: "指定された患者が見つかりません。" }, 404);
        }
        const parsePatient: GetPatientSchema = getPatientSchema.parse(patient);
        return context.json(parsePatient)
    } catch (e) {
        return context.json({ error: "データの取得に失敗しました。" }, 400)
    }
})

router.put("/:patient_id", requireDoctor, async (context) => {
    try {
        const { id, name, sex, tel, email, address, birth }: PatientType = await context.req.json();
        const updated_at: Date = new Date();
        const validatedData: UpdatePatientSchema = updatePatientSchema.parse({ id, name, sex, tel, email, address, birth, updated_at });
        const result = await prisma.patients.update({
            where: { id },
            data: validatedData
        });
        return context.json(result)
    } catch (e) {
        return context.json({ error: "データの更新に失敗しました。" }, 400)
    }
})

// 患者のデータ作成
router.post("/", requireDoctor, async (context) => {
    try {
        const { name, sex, tel, email, address, birth }: PatientType = await context.req.json();
        const password = dayjs(birth).format("YYYYMMDD");
        const validatedData: CreatePatientSchema = createPatientSchema.parse({ name, sex, tel, email, address, birth, password });
        const result = await prisma.patients.create({
            data: validatedData
        });
        return context.json(result)
    } catch (e) {
        return context.json({ error: "データの登録に失敗しました。" }, 400)
    }
})

export default router
