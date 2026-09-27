import { MedicalRecordsType, medicalRecordSortColumns } from "@repo/schema";
import { useState } from "react";
import usePagedQuery, { revalidatePagedQueries } from "./usePagedQuery";
import { trpcClient } from "../../lib/trpc";

const MEDICAL_RECORDS_PAGE_QUERY_NAME = "doctor.medicalRecords.page";

// 保存・削除の後は、今表示しているページだけでなく、全ページのキャッシュを取り直す。
// 今のページだけだと、別のページへ切り替えたときに古い内容が一瞬表示される。
const revalidateMedicalRecordsPages = (): Promise<void> =>
  revalidatePagedQueries(MEDICAL_RECORDS_PAGE_QUERY_NAME);

// 診察履歴の一覧の取得と、編集モーダルで開いている診察の状態をまとめる。
// 列の定義は features/doctor/medical-records/medicalRecordsColumns.ts に置く。
const useMedicalRecords = (patients_id: number) => {
  const [selectedRecord, setSelectedRecord] =
    useState<MedicalRecordsType | null>(null);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  // 移植前の API と同じく新しい順（id の降順）を既定の並びにする。
  const { table, error } = usePagedQuery({
    queryKey: [MEDICAL_RECORDS_PAGE_QUERY_NAME, patients_id],
    sortColumns: medicalRecordSortColumns,
    defaultSorting: { id: "id", desc: true },
    fetchPage: (pageRequest) =>
      trpcClient.doctor.medicalRecords.page.query({
        patientId: patients_id,
        ...pageRequest,
      }),
  });

  return {
    table,
    error,
    revalidateMedicalRecords: revalidateMedicalRecordsPages,
    selectedRecord,
    setSelectedRecord,
    isNewRecord,
    setIsNewRecord,
  };
};

export default useMedicalRecords;
