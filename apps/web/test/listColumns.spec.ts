import { describe, test, expect } from "vitest";
import {
    doctorSortColumns,
    medicalRecordSortColumns,
    patientSortColumns,
} from "@repo/schema";
import type { MedicalRecordType } from "../src/lib/trpc";
import type { RowData } from "@tanstack/react-table";
import type { DataTableColumns } from "../src/app/features/doctor/components/dataTable/dataTableFeatures";
import { doctorsListColumns } from "../src/app/features/doctor/doctors-list/doctorsListColumns";
import {
    formatExaminationAt,
    medicalRecordsColumns,
} from "../src/app/features/doctor/medical-records/medicalRecordsColumns";
import { patientsListColumns, toSexLabel } from "../src/app/features/doctor/patients-list/patientsListColumns";

// 列の id は、明示した id か accessor のキーになる（TanStack Table の決まり）。
const toColumnId = <Item extends RowData>(column: DataTableColumns<Item>[number]): string | undefined =>
    column.id ?? ("accessorKey" in column ? String(column.accessorKey) : undefined);

// 列が見つからなければテストを失敗させ、見つかった列だけを返す。
const findColumnById = <Item extends RowData>(
    columns: DataTableColumns<Item>,
    columnId: string
): DataTableColumns<Item>[number] => {
    const foundColumn = columns.find((column) => toColumnId(column) === columnId);
    if (!foundColumn) {
        throw new Error(`列「${columnId}」が見つかりません。`);
    }
    return foundColumn;
};

const sortableColumnIds = <Item extends RowData>(columns: DataTableColumns<Item>): (string | undefined)[] =>
    columns.filter((column) => column.enableSorting !== false).map(toColumnId);

describe("列の id と API の sortBy", () => {
    // 見出しを押したときの列の id が、そのまま API の sortBy になる。
    // 許可されていない列を並べ替え可能にすると、押しても既定の並びに戻ってしまう。
    test.each([
        ["患者一覧", sortableColumnIds(patientsListColumns), patientSortColumns],
        ["医師一覧", sortableColumnIds(doctorsListColumns), doctorSortColumns],
        ["診察履歴", sortableColumnIds(medicalRecordsColumns), medicalRecordSortColumns],
    ])("%sの並べ替えられる列は、すべて API が受け付ける", (_, columnIds, sortColumns) => {
        expect(sortColumns).toEqual(expect.arrayContaining(columnIds));
    });
});

describe("患者一覧の列", () => {
    test("性別は表示名で表示する", () => {
        expect(toSexLabel("woman")).toBe("女性");
        expect(toSexLabel("no_answer")).toBe("未回答");
    });
});

describe("診察履歴の列", () => {
    test("診察日は日本時間で表示し、日付をまたぐ時刻は翌日になる", () => {
        expect(formatExaminationAt(new Date("2026-09-01T15:30:00.000Z"))).toBe("2026年9月2日 0:30");
    });

    test("施術の列は、施術名の配列を値にする", () => {
        const medicalRecord: MedicalRecordType = {
            id: 1,
            patient_id: 1,
            doctor_id: 1,
            medical_memo: "",
            doctor_memo: "",
            examination_at: new Date("2026-09-01T00:00:00.000Z"),
            categories: [
                { id: 2, treatment: "電気療法" },
                { id: 3, treatment: "手技療法" },
            ],
        };
        const categoriesColumn = findColumnById(medicalRecordsColumns, "categories");
        if (!("accessorFn" in categoriesColumn)) {
            throw new Error("施術の列は、施術名を取り出す accessorFn を持つはずです。");
        }

        expect(categoriesColumn.accessorFn(medicalRecord, 0)).toEqual(["電気療法", "手技療法"]);
        expect(categoriesColumn.meta?.isMultipleValues).toBe(true);
    });
});
