import { prisma, Prisma } from "@repo/db";

// select を satisfies で型付けした上で戻り値型を明示しているのは、
// tsconfig の declaration: true 下で推論に任せると TS2883
// （PrismaPromise を含む推論結果を .d.ts に書き出せない）で
// ビルドが失敗するため。Prisma 7 の生成クライアント構造に起因する制約で、
// クエリの内容自体は移植前の doctor/categories.ts と変えていない。
const parentCategoriesSelect = {
    id: true,
    treatment: true,
    children: {
        select: {
            id: true,
            treatment: true,
        },
    },
} satisfies Prisma.categoriesSelect;

// 親カテゴリと、その子カテゴリを取得する。移植前の doctor/categories.ts の
// クエリをそのまま移した。
export const findParentCategoriesWithChildren = (): Prisma.PrismaPromise<
    Array<Prisma.categoriesGetPayload<{ select: typeof parentCategoriesSelect }>>
> =>
    prisma.categories.findMany({
        select: parentCategoriesSelect,
        where: {
            parent_id: null,
        },
    });
