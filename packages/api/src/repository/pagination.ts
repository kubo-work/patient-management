import type { PageRequest, SortOrder } from "@repo/schema";

// repository が返す 1 ページ分の結果。totalCount はページングする前の全件数。
export type PageResult<Item> = {
    items: Item[];
    totalCount: number;
};

type OrderBy<SortColumn extends string> = Partial<Record<SortColumn | "id", SortOrder>>;

// 一覧 API の入力を Prisma の findMany の引数へ変換する。page は 1 始まり。
//
// sortBy が id 以外のときは id の昇順を 2 番目のキーに加える。同じ値の行の並びは
// PostgreSQL では保証されず、ページをまたいで行が重複したり抜けたりするため。
//
// as OrderBy<SortColumn> は外せない。SortColumn が型引数のままだと、TypeScript は
// { [sortBy]: sortOrder } の計算されたキーを string に広げ、{ id: ... } も
// Partial<Record<SortColumn | "id", ...>> の形として照合できないため。
export const toPrismaPaging = <SortColumn extends string>({
    page,
    pageSize,
    sortBy,
    sortOrder,
}: PageRequest<SortColumn>): {
    skip: number;
    take: number;
    orderBy: OrderBy<SortColumn>[];
} => ({
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy:
        sortBy === "id"
            ? [{ id: sortOrder } as OrderBy<SortColumn>]
            : [{ [sortBy]: sortOrder } as OrderBy<SortColumn>, { id: "asc" } as OrderBy<SortColumn>],
});
