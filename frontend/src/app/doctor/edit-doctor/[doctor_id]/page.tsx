import EditDoctorContents from "@/app/features/doctor/edit-doctor/EditDoctorContents";
import { Title } from "@mantine/core";
import { Metadata } from "next";

// 静的エクスポート用（実データはクライアントサイドで SWR が取得）
// Next.js 16 の output: export は空配列不可のためプレースホルダーを返す
export function generateStaticParams() {
  return [{ doctor_id: "0" }];
}

type PageParams = {
  params: Promise<{ doctor_id: string }>;
};

export const metadata: Metadata = {
  title: "お医者さんを編集",
};

const Page = async ({ params }: PageParams) => {
  const { doctor_id } = await params;
  const setId = Number(doctor_id);
  return (
    <>
      <Title order={1} py={30}>
        お医者さんを編集
      </Title>
      <EditDoctorContents id={setId} />
    </>
  );
};

export default Page;
