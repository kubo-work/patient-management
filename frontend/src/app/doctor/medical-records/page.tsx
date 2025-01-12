import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { API_URL } from "../../../../constants/url";
import { Metadata } from "next";
import { PatientType } from "../../../../../common/types/PatientType";
import { Title } from "@mantine/core";
import MedicalRecordsContents from "@/app/features/doctor/medical-records/MedicalRecordsContents";
import { doctorCookieKeyName } from "../../../../constants/cookieKey";
import { getCookie } from "cookies-next";

const getPatients = async (patients_id: number) => {
  const token = getCookie(doctorCookieKeyName, { cookies });
  return await fetch(`${API_URL}/doctor/patients/${patients_id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
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
  const patientData: PatientType = await getPatients(patients_id);
  if (!patientData) {
    notFound();
  }
  return (
    <>
      <header>
        <Title order={1} ta="center">
          {patientData.name} 様
        </Title>
      </header>
      <MedicalRecordsContents
        patientData={patientData}
        patients_id={patients_id}
      />
    </>
  );
};

export default Page;
