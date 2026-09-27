"use client";
import { type ReactNode } from "react";
import { Box, LoadingOverlay, Table } from "@mantine/core";
import { useTable, type RowData } from "@tanstack/react-table";
import type { PagedTableState } from "../../../../hooks/usePagedQuery";
import { dataTableFeatures, type DataTableColumns } from "./dataTableFeatures";
import DataTableBody from "./DataTableBody";
import DataTableHeaderCell from "./DataTableHeaderCell";
import DataTablePagination from "./DataTablePagination";

type Props<Item extends RowData> = PagedTableState<Item> & {
  columns: DataTableColumns<Item>;
  // 行ごとの操作（編集ボタンなど）。列定義を JSX を含まないデータに保つため、列とは別に受け取る。
  renderRowActions?: (item: Item) => ReactNode;
};

// ページングとソートをサーバ側（doctor.*.page）で行う一覧テーブル。
// 表示中の行・全件数・ページとソートの状態は usePagedQuery が持ち、このコンポーネントは
// それを表示し、操作を usePagedQuery へ伝えるだけにする。
//
// ソートの解除は無効にする。解除しても API は既定の並びで返すため、表示と実際の並びが食い違う。
const DataTable = <Item extends RowData>({
  columns,
  items,
  totalCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  isLoading,
  renderRowActions,
}: Props<Item>) => {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: items,
    state: { pagination, sorting },
    onPaginationChange,
    onSortingChange,
    manualPagination: true,
    manualSorting: true,
    rowCount: totalCount,
    enableSortingRemoval: false,
    enableMultiSort: false,
  });

  return (
    <Box pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <Table.Tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <DataTableHeaderCell key={header.id} header={header} />
              ))}
              {renderRowActions && <Table.Th>操作</Table.Th>}
            </Table.Tr>
          ))}
        </Table.Thead>
        <DataTableBody
          rows={table.getRowModel().rows}
          columnCount={columns.length + (renderRowActions ? 1 : 0)}
          isLoading={isLoading}
          renderRowActions={renderRowActions}
        />
      </Table>
      <DataTablePagination
        totalCount={totalCount}
        pageIndex={pagination.pageIndex}
        pageSize={pagination.pageSize}
        pageCount={table.getPageCount()}
        onPageIndexChange={(pageIndex) => table.setPageIndex(pageIndex)}
        onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
      />
    </Box>
  );
};

export default DataTable;
