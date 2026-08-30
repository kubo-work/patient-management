import { Hono } from "hono";
import { requireDoctor, type DoctorAuthVariables } from "../middleware/requireDoctor.js";
import { Prisma, prisma } from "@repo/db";
import { DoctorType } from "@repo/schema";
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

const router = new Hono<{ Variables: DoctorAuthVariables }>();

router.get("/", requireDoctor, async (context) => {
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
        return context.json(parseDoctors);
    } catch (e) {
        return context.json({ error: "データの取得に失敗しました。" }, 400);
    }
})

// 医者データ取得
router.get("/:doctor_id", requireDoctor, async (context) => {
    try {
        const doctor_id = Number(context.req.param("doctor_id"))
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
            return context.json({ error: "指定された医師が見つかりません。" }, 404);
        }
        const parseDoctor: GetDoctorSchema = getDoctorSchema.parse(doctor);
        return context.json(parseDoctor)
    } catch (e) {
        return context.json({ error: "データの取得に失敗しました。" }, 400);
    }
})

type PutRequestDoctorType = Omit<DoctorType, "id">

// 医者データ更新
// 移植前はこの PUT だけ認可が無く、トークン無しで任意の医師のパスワードを
// 書き換えられた。ログインは平文一致のため、そのまま乗っ取りが成立する。
// 本 Issue で唯一、振る舞いを変えて塞いだ箇所（ADR 0002 決定 7）。
router.put("/:doctor_id", requireDoctor, async (context) => {
    try {
        const doctor_id = Number(context.req.param("doctor_id"))
        const { name, email, password }: PutRequestDoctorType = await context.req.json();
        const updated_at: Date = new Date();

        const parsedData: {
            success: true;
            data: UpdateDoctorSchema;
        } | {
            success: false;
            error: ZodError;
        } = updateDoctorSchema.safeParse({ name, email, password, updated_at });
        if (!parsedData.success) {
            return context.json({
                error: "入力データが不正です。",
            }, 400);
        }
        const result = await prisma.doctors.update({
            where: { id: doctor_id },
            data: parsedData.data
        });
        return context.json(result)
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return context.json({ error: "指定された医師が見つかりません。" }, 404);
        } else {
            return context.json({ error: "データの更新に失敗しました。" }, 400);
        }
    }
})

// 医者データ新規作成
router.post("/", requireDoctor, async (context) => {
    try {
        const { name, email, password }: DoctorType = await context.req.json();
        const parsedData: {
            success: true;
            data: CreateDoctorSchema;
        } | {
            success: false;
            error: ZodError;
        } = createDoctorSchema.safeParse({ name, email, password });
        if (!parsedData.success) {
            return context.json({
                error: "入力データが不正です。",
            }, 400);
        }
        const result = await prisma.doctors.create({
            data: parsedData.data
        });
        return context.json({ data: result })
    } catch (e) {
        return context.json({ error: "データの保存に失敗しました。" }, 400);
    }
})

export default router;
