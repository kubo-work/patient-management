import { notFound } from "next/navigation";
import { API_URL } from "../../../../constants/url";
import { Metadata } from "next";
import { PatientType } from "../../../../../common/types/PatientType";
import { Title } from "@mantine/core";
import MedicalRecordsContents from "@/app/features/doctor/medical-records/MedicalRecordsContents";
import { cookies } from "next/headers";
import { doctorCookieName } from "../../../../../common/util/CookieName";
const getPatients = async (
  patients_id: number
): Promise<PatientType | undefined> => {
  const cookieStore = cookies();
  const token = cookieStore.get(doctorCookieName)?.value || "";
  return await fetch(`${API_URL}/doctor/patients/${patients_id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${doctorCookieName}=${token}`,
    },

    credentials: "same-origin",
  }).then((res) => res.json());
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
  const patientsData: PatientType | undefined = await getPatients(patients_id);
  if (!patientsData) {
    return { title: errorTitle };
  }
  return {
    title: `${patientsData.name} 様 編集画面`,
  };
}

const Page = async ({ searchParams }: QueryParamType) => {
  const patients_id = searchParams.patients_id;
  if (!patients_id) {
    notFound();
  }
  const patientData: PatientType | undefined = await getPatients(patients_id);
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
