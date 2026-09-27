import {
  createColumnHelper,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";

// 列ごとの表示の指定。
export type DataTableColumnMeta = {
  // 見出しのセルの幅（px）。
  width?: number;
  // 値が文字列の配列の列（施術など）。DataTable が箇条書きで表示する。
  // 列定義を JSX を含まないデータに保つため、cell で描画せず、この印で表示方法を指定する。
  isMultipleValues?: boolean;
};

// 一覧のテーブルで使う機能。ソートとページングはサーバ側（doctor.*.page）で行うため、
// 状態と操作だけを登録し、クライアント側で並べ替える sortedRowModel や
// ページに分ける paginatedRowModel は登録しない。
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

// 列の値の型（TValue）は列ごとに違うため、配列としてまとめると any になる。
// 列ヘルパーの columns() も同じ型を返す（TanStack Table の ColumnHelper の定義）。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumns<Item extends RowData> = Array<ColumnDef<DataTableFeatures, Item, any>>;

export const createDataTableColumnHelper = <Item extends RowData>() =>
  createColumnHelper<DataTableFeatures, Item>();
