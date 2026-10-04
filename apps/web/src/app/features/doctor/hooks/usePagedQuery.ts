"use client";
import { useState } from "react";
import {
    keepPreviousData,
    useQuery,
    type QueryKey,
    type UseQueryOptions,
} from "@tanstack/react-query";
import { pageSizeOptions, type PageRequest } from "@repo/schema";
import {
    toLastPageIndex,
    toPageQuery,
    type PaginationState,
    type SortingState,
    type StateUpdater,
} from "../../../util/pageQuery";
import type { FetchError } from "../../../util/fetchError";

// テーブルに渡す表示状態と操作。DataTable の props と同じ形。
export type PagedTableState<Item> = {
    items: Item[];
    totalCount: number;
    pagination: PaginationState;
    onPaginationChange: (updater: StateUpdater<PaginationState>) => void;
    sorting: SortingState;
    onSortingChange: (updater: StateUpdater<SortingState>) => void;
    isLoading: boolean;
    // 取得に失敗していれば、そのエラー。表の上に表示する。
    fetchError: FetchError | null;
};

// 一覧 API（doctor.*.page）の出力に共通する形。行の型は各 API の推論結果をそのまま受け取る。
type FetchedPage<Item> = { items: Item[]; totalCount: number };

type PagedQueryOptions<
    SortColumn extends string,
    Item,
    PageError extends FetchError,
    PageQueryKey extends QueryKey,
> = {
    sortColumns: readonly SortColumn[];
    defaultSorting: { id: SortColumn; desc: boolean };
    // ページとソートの条件から、取得の設定（trpc.doctor.*.page.queryOptions の戻り値）を作る。
    createQueryOptions: (
        pageRequest: PageRequest<SortColumn>
    ) => UseQueryOptions<FetchedPage<Item>, PageError, FetchedPage<Item>, PageQueryKey>;
};

// 取得前に data が無い間も、毎回同じ配列を返して参照が変わらないようにする。
const EMPTY_ITEMS: never[] = [];

// サーバ側でページングとソートをする一覧の、表示状態と取得をまとめる。
// ページとソートは表示状態なので state で持ち、API の入力はそこから計算する。
const usePagedQuery = <
    SortColumn extends string,
    Item,
    PageError extends FetchError,
    PageQueryKey extends QueryKey,
>({
    sortColumns,
    defaultSorting,
    createQueryOptions,
}: PagedQueryOptions<SortColumn, Item, PageError, PageQueryKey>) => {
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: pageSizeOptions[0],
    });
    const [sorting, setSorting] = useState<SortingState>([defaultSorting]);
    const pageRequest = toPageQuery(pagination, sorting, sortColumns, defaultSorting);

    const { data, isLoading, isPlaceholderData, error } = useQuery({
        ...createQueryOptions(pageRequest),
        // ページを切り替えている間も前のページを表示し、表が一瞬空になるのを防ぐ。
        placeholderData: keepPreviousData,
    });

    // 最後のページの行を削除するなどして今のページが無くなったら、最後のページへ移る。
    // 前のページを仮に表示している間（isPlaceholderData）の全件数は、今の条件の応答ではないため使わない。
    if (data !== undefined && !isPlaceholderData) {
        const lastPageIndex = toLastPageIndex(data.totalCount, pageRequest.pageSize);
        if (pagination.pageIndex > lastPageIndex) {
            setPagination({ ...pagination, pageIndex: lastPageIndex });
        }
    }

    // 並び順が変わると今のページの位置に意味が無くなるため、1 ページ目へ戻す。
    const handleSortingChange = (updater: StateUpdater<SortingState>): void => {
        setSorting(updater);
        setPagination((previousPagination) => ({ ...previousPagination, pageIndex: 0 }));
    };

    const table: PagedTableState<Item> = {
        items: data?.items ?? EMPTY_ITEMS,
        totalCount: data?.totalCount ?? 0,
        pagination,
        onPaginationChange: setPagination,
        sorting,
        onSortingChange: handleSortingChange,
        isLoading,
        fetchError: error,
    };
    return { table };
};

export default usePagedQuery;
