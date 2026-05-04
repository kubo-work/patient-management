import EditPatientContents from "@/app/features/doctor/edit-patient/EditPatientContents";
import { Title } from "@mantine/core";
import { Metadata } from "next";

// 静的エクスポート用（実データはクライアントサイドで SWR が取得）
export const dynamicParams = false;
export function generateStaticParams() {
  return [];
}

type PageParams = {
  params: Promise<{ patient_id: string }>;
};

export const metadata: Metadata = {
  title: "患者情報を編集",
};

const Page = async ({ params }: PageParams) => {
  const { patient_id } = await params;
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
