import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc/init.js";
import { findParentCategoriesWithChildren } from "../repository/categories.js";

const categorySchema = z.object({
    id: z.number(),
    treatment: z.string(),
});

const getCategorySchema = categorySchema.extend({
    children: z.array(categorySchema),
});

const getCategoriesSchema = z.array(getCategorySchema);

export const categoriesRouter = router({
    list: protectedProcedure.query(async () => {
        try {
            return getCategoriesSchema.parse(await findParentCategoriesWithChildren());
        } catch {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "データの取得に失敗しました。",
            });
        }
    }),
});
