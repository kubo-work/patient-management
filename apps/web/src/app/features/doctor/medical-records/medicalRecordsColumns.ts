import type { MedicalRecordType } from "../../../../lib/trpc";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { createDataTableColumnHelper } from "../components/dataTable/dataTableFeatures";

dayjs.extend(utc);
dayjs.extend(timezone);

// 院のある地域のタイムゾーン。診察日は UTC で保存されているため、表示時にこの時刻へ変換する。
const CLINIC_TIME_ZONE = "Asia/Tokyo";

export const formatExaminationAt = (examinationAt: Date): string =>
  dayjs(examinationAt).utc().tz(CLINIC_TIME_ZONE).format("YYYY年M月D日 H:mm");

const columnHelper = createDataTableColumnHelper<MedicalRecordType>();

// 列の id は、API の sortBy（@repo/schema の medicalRecordSortColumns）と同じ文字列にする。
export const medicalRecordsColumns = columnHelper.columns([
  columnHelper.accessor("id", { header: "ID", meta: { width: 50 } }),
  columnHelper.accessor("examination_at", {
    header: "診察日",
    cell: (info) => formatExaminationAt(info.getValue()),
    meta: { width: 200 },
  }),
  // 施術名の配列を値にし、isMultipleValues で箇条書きの表示を指定する。
  // 値が複数あるため、API はこの列での並べ替えを受け付けない。
  columnHelper.accessor(
    (medicalRecord) => medicalRecord.categories.map((category) => category.treatment),
    {
      id: "categories",
      header: "施術",
      enableSorting: false,
      meta: { isMultipleValues: true },
    }
  ),
]);
