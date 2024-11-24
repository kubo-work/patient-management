import { Request, Response, Router } from "express";
import { prisma } from "../prisma.js";
import { verifyAuthToken } from "../verifyAuthToken.js";

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
        return response.json(allCategories);
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
});

export default router;
