"use client";
import { medicalRecordSortColumns } from "@repo/schema";
import { useState } from "react";
import usePagedQuery from "../../hooks/usePagedQuery";
import { useTRPC, type MedicalRecordType } from "../../../../../lib/trpc";

// 診察履歴の一覧の取得と、編集モーダルで開いている診察の状態をまとめる。
// 列の定義は features/doctor/medical-records/medicalRecordsColumns.ts に置く。
// 保存・削除の後の取り直しは、保存する側（useMedicalRecordForm）が行う。
const useMedicalRecords = (patientId: number) => {
  const trpc = useTRPC();
  const [selectedRecord, setSelectedRecord] =
    useState<MedicalRecordType | null>(null);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  // 移植前の API と同じく新しい順（id の降順）を既定の並びにする。
  const { table } = usePagedQuery({
    sortColumns: medicalRecordSortColumns,
    defaultSorting: { id: "id", desc: true },
    createQueryOptions: (pageRequest) =>
      trpc.doctor.medicalRecords.page.queryOptions({ patientId, ...pageRequest }),
  });

  return {
    table,
    selectedRecord,
    setSelectedRecord,
    isNewRecord,
    setIsNewRecord,
  };
};

export default useMedicalRecords;
