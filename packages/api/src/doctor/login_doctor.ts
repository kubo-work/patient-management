import { Hono } from "hono";
import { prisma } from "@repo/db";
import { requireDoctor, type DoctorAuthVariables } from "../middleware/requireDoctor.js";
import { DoctorType } from "@repo/schema";
import { z } from "zod";

const getDoctorSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    password: z.string(),
});

type GetDoctorSchema = z.infer<typeof getDoctorSchema>;

const router = new Hono<{ Variables: DoctorAuthVariables }>();

router.get("/", requireDoctor, async (context) => {
    try {
        // requireDoctor を通過しているため doctorId は必ず number。
        // Express 時代にあった request.user の null チェックは型で不要になった。
        const doctorId = context.get("doctorId");
        const doctor: DoctorType | null = await prisma.doctors.findFirst({
            select: {
                id: true,
                name: true,
                email: true,
                password: true
            },
            where: {
                AND: [
                    { id: doctorId }
                ]
            }
        })
        // doctor が null の場合
        if (!doctor) {
            return context.json({ error: "指定された医師が見つかりません。" }, 404);
        }
        const parseDoctor: GetDoctorSchema = getDoctorSchema.parse(doctor);
        return context.json(parseDoctor)
    } catch (e) {
        return context.json({ error: "データの取得に失敗しました。" }, 400);
    }
});

export default router;
