import { MedicalRecordsType, medicalRecordSortColumns } from "@repo/schema";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Button, List, ListItem } from "@mantine/core";
import { MRT_ColumnDef } from "mantine-react-table";
import usePagedQuery, { revalidatePagedQueries } from "./usePagedQuery";
import { trpcClient } from "../../lib/trpc";

dayjs.extend(utc);
dayjs.extend(timezone);

const MEDICAL_RECORDS_PAGE_QUERY_NAME = "doctor.medicalRecords.page";

// 保存・削除の後は、今表示しているページだけでなく、全ページのキャッシュを取り直す。
// 今のページだけだと、別のページへ切り替えたときに古い内容が一瞬表示される。
const revalidateMedicalRecordsPages = (): Promise<void> =>
  revalidatePagedQueries(MEDICAL_RECORDS_PAGE_QUERY_NAME);

const useMedicalRecords = (patients_id: number) => {
  const [selectedRecord, setSelectedRecord] =
    useState<MedicalRecordsType | null>(null);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  // 移植前の API と同じく新しい順（id の降順）を既定の並びにする。
  const { table, error } = usePagedQuery({
    queryKey: [MEDICAL_RECORDS_PAGE_QUERY_NAME, patients_id],
    sortColumns: medicalRecordSortColumns,
    defaultSorting: { id: "id", desc: true },
    fetchPage: (pageQuery) =>
      trpcClient.doctor.medicalRecords.page.query({
        patientId: patients_id,
        ...pageQuery,
      }),
  });

  const columns = useMemo<MRT_ColumnDef<MedicalRecordsType>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        maxSize: 50,
      },
      {
        accessorKey: "examination_at",
        header: "診察日",
        Cell: ({ row }) => {
          const examination_at: dayjs.Dayjs = dayjs(
            row.original.examination_at
          ).utc();
          const setTimeZone: dayjs.Dayjs = examination_at.tz("Asia/Tokyo");
          const format: string = setTimeZone.format("YYYY年M月D日 H:mm");
          return format;
        },
        maxSize: 200,
      },
      {
        accessorKey: "category",
        header: "施術",
        // 施術は複数の値を持つため、API はこの列での並べ替えを受け付けない。
        enableSorting: false,
        Cell: ({ row }) => (
          <List>
            {row.original.categories.map((category, i) => (
              <ListItem key={i}>{category.treatment}</ListItem>
            ))}
          </List>
        ),
      },
      {
        header: "操作",
        Cell: ({ row }) => (
          <>
            <Button
              onClick={() => {
                setIsNewRecord(false);
                setSelectedRecord(row.original);
              }}
            >
              編集
            </Button>
          </>
        ),
        maxSize: 80,
      },
    ],
    [setIsNewRecord, setSelectedRecord]
  );

  return {
    table,
    error,
    revalidateMedicalRecords: revalidateMedicalRecordsPages,
    selectedRecord,
    setSelectedRecord,
    isNewRecord,
    setIsNewRecord,
    columns,
  };
};

export default useMedicalRecords;
