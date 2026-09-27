"use client";
import { useState } from "react";
import useSWR, { mutate as mutateGlobalCache } from "swr";
import { pageSizeOptions, type PageRequest } from "@repo/schema";
import {
    toLastPageIndex,
    toPageQuery,
    type PaginationState,
    type SortingState,
    type StateUpdater,
} from "../util/pageQuery";

// テーブルに渡す表示状態と操作。ServerPagedTable の props と同じ形。
export type PagedTableState<Item> = {
    items: Item[];
    totalCount: number;
    pagination: PaginationState;
    onPaginationChange: (updater: StateUpdater<PaginationState>) => void;
    sorting: SortingState;
    onSortingChange: (updater: StateUpdater<SortingState>) => void;
    isLoading: boolean;
};

// 一覧 API（doctor.*.page）の出力に共通する形。行の型は各 API の推論結果をそのまま受け取る。
type FetchedPage<Item> = { items: Item[]; totalCount: number };

type PagedQueryOptions<SortColumn extends string, Item> = {
    // SWR のキーの先頭。先頭の要素（API 名）で revalidatePagedQueries の対象を絞り込む。
    queryKey: readonly [queryName: string, ...scope: unknown[]];
    sortColumns: readonly SortColumn[];
    defaultSorting: { id: SortColumn; desc: boolean };
    fetchPage: (pageRequest: PageRequest<SortColumn>) => Promise<FetchedPage<Item>>;
};

// 取得前に data が無い間も、毎回同じ配列を返して参照が変わらないようにする。
const EMPTY_ITEMS: never[] = [];

// サーバ側でページングとソートをする一覧の、表示状態と取得をまとめる。
// ページとソートは表示状態なので state で持ち、API の入力はそこから計算する。
const usePagedQuery = <SortColumn extends string, Item>({
    queryKey,
    sortColumns,
    defaultSorting,
    fetchPage,
}: PagedQueryOptions<SortColumn, Item>) => {
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: pageSizeOptions[0],
    });
    const [sorting, setSorting] = useState<SortingState>([defaultSorting]);
    const pageRequest = toPageQuery(pagination, sorting, sortColumns, defaultSorting);

    // 最後のページの行を削除するなどして今のページが無くなったら、最後のページへ移る。
    // SWR の onSuccess は最新の描画時の値を参照するため、ページを素早く切り替えると
    // 古い応答の全件数と新しいページ番号を比べてしまう。取得に使った pageRequest と
    // 応答を同じ関数の中で比べ、対応がずれないようにする。
    const fetchPageAndMoveToLastPage = async (): Promise<FetchedPage<Item>> => {
        const page = await fetchPage(pageRequest);
        const lastPageIndex = toLastPageIndex(page.totalCount, pageRequest.pageSize);
        if (pageRequest.page - 1 > lastPageIndex) {
            setPagination((previousPagination) => ({
                ...previousPagination,
                pageIndex: lastPageIndex,
            }));
        }
        return page;
    };

    const { data, isLoading, error } = useSWR(
        [...queryKey, pageRequest],
        fetchPageAndMoveToLastPage,
        // ページを切り替えている間も前のページを表示し、表が一瞬空になるのを防ぐ。
        { keepPreviousData: true }
    );

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
    };
    return { table, error };
};

// 登録・更新の後に、指定した一覧 API のキャッシュを、ページやソートの条件によらずすべて取得し直す。
export const revalidatePagedQueries = async (queryName: string): Promise<void> => {
    await mutateGlobalCache((key) => Array.isArray(key) && key[0] === queryName);
};

export default usePagedQuery;
