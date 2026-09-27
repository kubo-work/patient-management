import type { DoctorType } from "@repo/schema";
import { createDataTableColumnHelper } from "../components/dataTable/dataTableFeatures";

const columnHelper = createDataTableColumnHelper<DoctorType>();

// 列の id（accessor のキー）は、API の sortBy（@repo/schema の doctorSortColumns）と同じ文字列にする。
export const doctorsListColumns = columnHelper.columns([
  columnHelper.accessor("id", { header: "ID", meta: { width: 40 } }),
  columnHelper.accessor("name", { header: "名前", meta: { width: 100 } }),
  columnHelper.accessor("email", { header: "メールアドレス" }),
]);
