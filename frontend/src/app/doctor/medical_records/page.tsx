import { notFound } from "next/navigation";
import { API_URL } from "../../../../constants/url";
import { Metadata } from "next";
import { PatientType } from "../../../../../common/types/PatientType";
import { Title } from "@mantine/core";
import MedicalRecordsContents from "@/app/features/doctor/medical_records/MedicalRecordsContents";

const getPatients = async (patients_id: number) => {
  return await fetch(`${API_URL}/patients/${patients_id}`)
    .then((res) => {
      const data: Promise<PatientType> = res.json();
      return data;
    })
    .catch((res) => res.json());
};

type QueryParamType = {
  searchParams: { [patients_id: string]: number | undefined };
};

export async function generateMetadata({
  searchParams,
}: QueryParamType): Promise<Metadata> {
  // メタデータ（タイトル）設定
  const errorTitle = "Not Found";
  const patients_id = searchParams.patients_id;
  if (!patients_id) {
    return { title: errorTitle };
  }
  const patientsData: PatientType = await getPatients(patients_id);

  return {
    title: `${patientsData.name} 様 編集画面` || errorTitle,
  };
}

const Page = async ({ searchParams }: QueryParamType) => {
  const patients_id = searchParams.patients_id;
  if (!patients_id) {
    notFound();
  }
  const patientsData: PatientType = await getPatients(patients_id);
  if (!patientsData) {
    notFound();
  }
  return (
    <>
      <header>
        <Title order={1} ta="center">
          {patientsData.name} 様
        </Title>
      </header>
      <MedicalRecordsContents
        name={patientsData.name}
        patients_id={patients_id}
      />
    </>
  );
};

export default Page;
