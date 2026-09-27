import { sexList, type SexTypes } from "@repo/schema";
import type { PatientListItemType } from "../../../../lib/trpc";
import { createDataTableColumnHelper } from "../components/dataTable/dataTableFeatures";

export const toSexLabel = (sex: keyof SexTypes): string => sexList[sex].label;

const columnHelper = createDataTableColumnHelper<PatientListItemType>();

// 列の id（accessor のキー）は、API の sortBy（@repo/schema の patientSortColumns）と同じ文字列にする。
export const patientsListColumns = columnHelper.columns([
  columnHelper.accessor("id", { header: "ID", meta: { width: 40 } }),
  columnHelper.accessor("name", { header: "名前", meta: { width: 100 } }),
  columnHelper.accessor("sex", {
    header: "性別",
    cell: (info) => toSexLabel(info.getValue()),
    meta: { width: 40 },
  }),
  columnHelper.accessor("address", { header: "住所" }),
]);
