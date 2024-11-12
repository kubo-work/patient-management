import EditPatientContents from "@/app/features/doctor/edit-patient/EditPatientContents";
import { Title } from "@mantine/core";
import { Metadata } from "next";

type PageParams = {
  params: { patient_id: string };
};

export const metadata: Metadata = {
  title: "患者情報を編集",
};

const Page = (params: PageParams) => {
  const { patient_id } = params.params;
  const setId = Number(patient_id);
  return (
    <>
      <Title order={1} py={30}>
        患者情報を編集
      </Title>
      <EditPatientContents id={setId} />
    </>
  );
};

export default Page;
