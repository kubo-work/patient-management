import { describe, test, expect } from "vitest";
import { patientSortColumns } from "@repo/schema";
import { toLastPageIndex, toPageQuery } from "../src/app/util/pageQuery";

const firstPage = { pageIndex: 0, pageSize: 10 };
const sortedByIdAscending = { id: "id", desc: false } as const;

describe("toPageQuery", () => {
    test("0 始まりの pageIndex を 1 始まりの page にし、ソートを sortBy / sortOrder にする", () => {
        expect(
            toPageQuery({ pageIndex: 2, pageSize: 20 }, [{ id: "name", desc: true }], patientSortColumns, sortedByIdAscending)
        ).toEqual({ page: 3, pageSize: 20, sortBy: "name", sortOrder: "desc" });
    });

    test.each([
        ["ソートが解除されている", []],
        ["許可していない列でソートしている", [{ id: "email", desc: true }]],
    ])("%sときは、既定の並びにする", (_, sorting) => {
        expect(toPageQuery(firstPage, sorting, patientSortColumns, sortedByIdAscending)).toMatchObject({
            sortBy: "id",
            sortOrder: "asc",
        });
    });

    test("選択肢に無いページサイズは、最初の選択肢にする", () => {
        expect(
            toPageQuery({ pageIndex: 0, pageSize: 1000 }, [], patientSortColumns, sortedByIdAscending).pageSize
        ).toBe(10);
    });
});

describe("toLastPageIndex", () => {
    test.each([
        [0, 10, 0],
        [10, 10, 0],
        [11, 10, 1],
        [21, 20, 1],
    ])("全 %i 件・1 ページ %i 件なら、最後のページは %i", (totalCount, pageSize, lastPageIndex) => {
        expect(toLastPageIndex(totalCount, pageSize)).toBe(lastPageIndex);
    });
});
