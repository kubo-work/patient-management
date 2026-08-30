import { router } from "./init.js";
import { categoriesRouter } from "../router/categories.js";

// doctor 名前空間を保つのは、患者向けの API を将来足す余地を残すため。
// 移植前の REST も /doctor/* だった。
export const appRouter = router({
    doctor: router({
        categories: categoriesRouter,
    }),
});

export type AppRouter = typeof appRouter;
