"use client";
import { type ReactNode } from "react";
import { List, Table } from "@mantine/core";
import { FlexRender, type Cell, type Row, type RowData } from "@tanstack/react-table";
import type { DataTableFeatures } from "./dataTableFeatures";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((element) => typeof element === "string");

// 列の meta で isMultipleValues を指定した列は、値を箇条書きで表示する。
// 指定があっても値が文字列の配列でなければ、通常のセルとして表示する。
const DataTableCellContent = <Item extends RowData>({
  cell,
}: {
  cell: Cell<DataTableFeatures, Item>;
}) => {
  const value = cell.getValue();
  if (cell.column.columnDef.meta?.isMultipleValues && isStringArray(value)) {
    return (
      <List>
        {value.map((element, index) => (
          <List.Item key={index}>{element}</List.Item>
        ))}
      </List>
    );
  }
  return <FlexRender cell={cell} />;
};

type Props<Item extends RowData> = {
  rows: Row<DataTableFeatures, Item>[];
  // 0 件のときのメッセージを、全列にまたがって表示するための列数。
  columnCount: number;
  isLoading: boolean;
  renderRowActions?: (item: Item) => ReactNode;
};

const DataTableBody = <Item extends RowData>({
  rows,
  columnCount,
  isLoading,
  renderRowActions,
}: Props<Item>) => {
  if (rows.length === 0) {
    return (
      <Table.Tbody>
        <Table.Tr>
          <Table.Td colSpan={columnCount} ta="center">
            {isLoading ? "" : "表示するデータがありません。"}
          </Table.Td>
        </Table.Tr>
      </Table.Tbody>
    );
  }
  return (
    <Table.Tbody>
      {rows.map((row) => (
        <Table.Tr key={row.id}>
          {row.getAllCells().map((cell) => (
            <Table.Td key={cell.id}>
              <DataTableCellContent cell={cell} />
            </Table.Td>
          ))}
          {renderRowActions && <Table.Td>{renderRowActions(row.original)}</Table.Td>}
        </Table.Tr>
      ))}
    </Table.Tbody>
  );
};

export default DataTableBody;
