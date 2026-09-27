"use client";
import { MantineReactTable, type MRT_ColumnDef, type MRT_RowData } from "mantine-react-table";
import { pageSizeOptions } from "@repo/schema";
import type { PagedTableState } from "@/app/hooks/usePagedQuery";

type Props<Item extends MRT_RowData> = PagedTableState<Item> & {
  columns: MRT_ColumnDef<Item>[];
};

const PAGE_SIZE_OPTION_LABELS: string[] = pageSizeOptions.map(String);

// ページングとソートをサーバ側（doctor.*.page）で行う一覧テーブル。
// 全体検索と列フィルタは無効にする。有効なままだと、表示中の 1 ページの中だけを
// 絞り込むことになり、全件から探したつもりで見落とすため。
// ソートの解除も無効にする。解除しても API は既定の並びで返すため、表示と実際の並びが食い違う。
const ServerPagedTable = <Item extends MRT_RowData>({
  columns,
  items,
  totalCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  isLoading,
}: Props<Item>) => (
  <MantineReactTable
    columns={columns}
    data={items}
    manualPagination
    manualSorting
    rowCount={totalCount}
    enableSortingRemoval={false}
    enableGlobalFilter={false}
    enableColumnFilters={false}
    onPaginationChange={onPaginationChange}
    onSortingChange={onSortingChange}
    state={{ pagination, sorting, isLoading }}
    mantinePaginationProps={{ rowsPerPageOptions: PAGE_SIZE_OPTION_LABELS }}
  />
);

export default ServerPagedTable;
