import { z } from "zod";
import { isPageSize, sortOrders } from "@repo/schema";

// 一覧 API（*.page）の入力と出力の zod スキーマを組み立てる。3 つの一覧で形を揃えるため、
// ここ 1 箇所で定義する。
//
// sortBy は一覧ごとに許可した列だけを受け付ける。任意の文字列を orderBy に渡すと、
// パスワードのような表示しない列でも並び順から値を推測できてしまうため。
// pageSize も選択肢に限る。上限が無いと 1 回のリクエストで全件を取れてしまい、
// ページングする意味が無くなるため。
export const createPageInputSchema = <SortColumn extends string>(
    sortColumns: readonly [SortColumn, ...SortColumn[]]
) =>
    z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().refine(isPageSize),
        sortBy: z.enum(sortColumns),
        sortOrder: z.enum(sortOrders),
    });

export const createPageOutputSchema = <ItemSchema extends z.ZodTypeAny>(itemSchema: ItemSchema) =>
    z.object({
        items: z.array(itemSchema),
        totalCount: z.number().int(),
    });
