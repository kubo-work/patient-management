"use client";
import { Flex, Pagination, Select, Text } from "@mantine/core";
import { pageSizeOptions } from "@repo/schema";

type Props = {
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const PAGE_SIZE_SELECT_DATA = pageSizeOptions.map((pageSize) => ({
  value: String(pageSize),
  label: `${pageSize} 件`,
}));

// 一覧の下部に、全件数・1 ページの件数の選択・ページ送りを表示する。
// pageIndex は 0 始まり、画面に出すページ番号は 1 始まり。
const DataTablePagination = ({
  totalCount,
  pageIndex,
  pageSize,
  pageCount,
  onPageIndexChange,
  onPageSizeChange,
}: Props) => (
  <Flex
    justify="space-between"
    align="center"
    gap="md"
    wrap="wrap"
    py="sm"
  >
    <Text size="sm">全 {totalCount} 件</Text>
    <Flex align="center" gap="md" wrap="wrap">
      <Select
        aria-label="1 ページの表示件数"
        data={PAGE_SIZE_SELECT_DATA}
        value={String(pageSize)}
        onChange={(value) => value !== null && onPageSizeChange(Number(value))}
        allowDeselect={false}
        w={100}
      />
      <Pagination
        total={pageCount}
        value={pageIndex + 1}
        onChange={(page) => onPageIndexChange(page - 1)}
      />
    </Flex>
  </Flex>
);

export default DataTablePagination;
