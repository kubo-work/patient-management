import { isPageSize, pageSizeOptions, type PageRequest } from "@repo/schema";

// テーブルが持つページングとソートの状態。形は TanStack Table の PaginationState / SortingState と同じ。
export type PaginationState = { pageIndex: number; pageSize: number };
export type ColumnSort = { id: string; desc: boolean };
export type SortingState = ColumnSort[];

// useState の更新関数と同じく、次の値か、前の値から次の値を求める関数を受け取る。
export type StateUpdater<State> = State | ((previousState: State) => State);

const isSortColumn = <SortColumn extends string>(
    sortColumns: readonly SortColumn[],
    columnId: string
): columnId is SortColumn => (sortColumns as readonly string[]).includes(columnId);

// テーブルの状態を API の入力へ変換する。API が受け付けない値（選択肢に無いページサイズ、
// ソートを許可していない列、ソートの解除）は既定値に置き換え、API に弾かれる入力を作らない。
export const toPageQuery = <SortColumn extends string>(
    pagination: PaginationState,
    sorting: SortingState,
    sortColumns: readonly SortColumn[],
    defaultSorting: { id: SortColumn; desc: boolean }
): PageRequest<SortColumn> => {
    const requestedSort = sorting.at(0);
    const { id, desc } =
        requestedSort !== undefined && isSortColumn(sortColumns, requestedSort.id)
            ? { id: requestedSort.id, desc: requestedSort.desc }
            : defaultSorting;
    return {
        page: pagination.pageIndex + 1,
        pageSize: isPageSize(pagination.pageSize) ? pagination.pageSize : pageSizeOptions[0],
        sortBy: id,
        sortOrder: desc ? "desc" : "asc",
    };
};

// 全件数から最後のページの pageIndex を求める。0 件のときは 0。
export const toLastPageIndex = (totalCount: number, pageSize: number): number =>
    Math.max(0, Math.ceil(totalCount / pageSize) - 1);
