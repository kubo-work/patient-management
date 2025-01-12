import { Response, Router } from "express";
import { prisma } from "../prisma.js";
import { verifyAuthToken } from "../verifyAuthToken.js";
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

type GetCategory = z.infer<typeof getCategorySchema>;

const router = Router();

// カテゴリを取得する
router.get("/", verifyAuthToken, async (_, response: Response) => {
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
        const parseCategories: GetCategory[] = getCategoriesSchema.parse(allCategories);
        return response.json(parseCategories);
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
});

export default router;
