"use client";
import { Group, Table, UnstyledButton } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconArrowsSort } from "@tabler/icons-react";
import { FlexRender, type Header, type RowData } from "@tanstack/react-table";
import type { DataTableFeatures } from "./dataTableFeatures";

type SortDirection = false | "asc" | "desc";

const ARIA_SORT_BY_DIRECTION = {
  asc: "ascending",
  desc: "descending",
} as const;

const SORT_ICON_SIZE = 14;

// 並べ替えできない列には aria-sort を付けない。並べ替えできるが未指定の列は "none" にする。
const toAriaSort = (canSort: boolean, direction: SortDirection) => {
  if (!canSort) return undefined;
  if (!direction) return "none";
  return ARIA_SORT_BY_DIRECTION[direction];
};

const SortDirectionIcon = ({ direction }: { direction: SortDirection }) => {
  if (direction === "asc") return <IconArrowUp size={SORT_ICON_SIZE} aria-hidden />;
  if (direction === "desc") return <IconArrowDown size={SORT_ICON_SIZE} aria-hidden />;
  return <IconArrowsSort size={SORT_ICON_SIZE} aria-hidden />;
};

type HeaderProps<Item extends RowData> = {
  header: Header<DataTableFeatures, Item>;
};

const DataTableHeaderLabel = <Item extends RowData>({
  header,
  canSort,
  sortDirection,
}: HeaderProps<Item> & { canSort: boolean; sortDirection: SortDirection }) => {
  if (header.isPlaceholder) return null;
  if (!canSort) return <FlexRender header={header} />;
  // button の中に div は置けないため、Group は span として描画する。
  return (
    <UnstyledButton onClick={header.column.getToggleSortingHandler()} fw={700} fz="sm">
      <Group component="span" gap={4} wrap="nowrap">
        <FlexRender header={header} />
        <SortDirectionIcon direction={sortDirection} />
      </Group>
    </UnstyledButton>
  );
};

// 見出しのセル。並べ替えできる列は見出しをボタンにし、向きをアイコンと aria-sort で示す。
const DataTableHeaderCell = <Item extends RowData>({ header }: HeaderProps<Item>) => {
  const canSort = header.column.getCanSort();
  const sortDirection = header.column.getIsSorted();
  return (
    <Table.Th
      w={header.column.columnDef.meta?.width}
      aria-sort={toAriaSort(canSort, sortDirection)}
    >
      <DataTableHeaderLabel header={header} canSort={canSort} sortDirection={sortDirection} />
    </Table.Th>
  );
};

export default DataTableHeaderCell;
