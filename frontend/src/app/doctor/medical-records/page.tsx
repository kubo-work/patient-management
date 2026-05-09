"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Title } from "@mantine/core";
import MedicalRecordsContents from "@/app/features/doctor/medical-records/MedicalRecordsContents";
import { PatientType } from "../../../../../common/types/PatientType";
import { API_URL } from "../../../../constants/url";

function MedicalRecordsInner() {
  const searchParams = useSearchParams();
  const patients_id = Number(searchParams.get("patients_id"));
  const [patientData, setPatientData] = useState<PatientType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patients_id) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/doctor/patients/${patients_id}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        setPatientData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [patients_id]);

  if (!patients_id) return <div>患者が選択されていません</div>;
  if (loading) return <div>Loading...</div>;
  if (!patientData) return <div>データが見つかりません</div>;

  return (
    <>
      <header>
        <Title order={1} ta="center">
          {patientData.name} 様
        </Title>
      </header>
      <MedicalRecordsContents patientData={patientData} patients_id={patients_id} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MedicalRecordsInner />
    </Suspense>
  );
}
