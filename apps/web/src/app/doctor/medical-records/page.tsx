"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Alert, Title } from "@mantine/core";
import { skipToken, useQuery } from "@tanstack/react-query";
import FetchErrorAlert from "@/app/features/doctor/components/FetchErrorAlert";
import LoadingIndicator from "@/app/features/doctor/components/LoadingIndicator";
import MedicalRecordsContents from "@/app/features/doctor/medical-records/MedicalRecordsContents";
import { useTRPC } from "../../../lib/trpc";

const MedicalRecordsInner = () => {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  // patients_id が無い・数値でないときは 0 か NaN になり、どちらも「患者が選択されていない」として扱う。
  const patientId = Number(searchParams.get("patients_id"));
  const hasPatientId = Boolean(patientId);

  const { data: patient, error } = useQuery(
    trpc.doctor.patients.byId.queryOptions(hasPatientId ? { patientId } : skipToken)
  );

  if (!hasPatientId) return <Alert color="red">患者が選択されていません</Alert>;
  // 取得済みの患者があれば、表示を続ける。表示後の取り直しが失敗しても、
  // 入力中の診察フォームごと画面を外さない。
  if (patient === undefined) {
    return error ? <FetchErrorAlert error={error} /> : <LoadingIndicator />;
  }

  return (
    <>
      <header>
        <Title order={1} ta="center">
          {patient.name} 様
        </Title>
      </header>
      <MedicalRecordsContents patientData={patient} patients_id={patientId} />
    </>
  );
};

const Page = () => {
  return (
    <Suspense fallback={<LoadingIndicator />}>
      <MedicalRecordsInner />
    </Suspense>
  );
};

export default Page;
