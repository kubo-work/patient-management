import EditPatientContents from "@/app/features/doctor/edit-patient/EditPatientContents";
import { Title } from "@mantine/core";
import { Metadata } from "next";

// 静的エクスポート用（実データはクライアントサイドで SWR が取得）
// Next.js 16 の output: export は空配列不可のためプレースホルダーを返す
export function generateStaticParams() {
  return [{ patient_id: "0" }];
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
