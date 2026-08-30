import { Hono } from "hono";
import { prisma } from "@repo/db";
import { requireDoctor, type DoctorAuthVariables } from "../middleware/requireDoctor.js";
import { z } from "zod";

const categorySchema = {
    id: z.number(),
    treatment: z.string(),
};

const getCategorySchema = z.object({
    id: z.number(),
    treatment: z.string(),
    children: z.array(z.object(categorySchema)),
})

const getCategoriesSchema = z.array(getCategorySchema);

type GetCategorySchema = z.infer<typeof getCategorySchema>;

const router = new Hono<{ Variables: DoctorAuthVariables }>();

// カテゴリを取得する
router.get("/", requireDoctor, async (context) => {
    try {
        const allCategories = await prisma.categories.findMany({
            select: {
                id: true,
                treatment: true,
                children: {
                    select: {
                        id: true,
                        treatment: true
                    }
                }
            },
            where: {
                parent_id: null
            }
        });
        const parseCategories: GetCategorySchema[] = getCategoriesSchema.parse(allCategories);
        return context.json(parseCategories);
    } catch (e) {
        return context.json({ error: "データの取得に失敗しました。" }, 400);
    }
});

export default router;
