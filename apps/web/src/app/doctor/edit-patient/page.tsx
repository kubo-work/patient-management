import EditPatientContents from "@/app/features/doctor/edit-patient/EditPatientContents";
import { Title } from "@mantine/core";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "新しい患者さんを登録",
};

const Page = () => {
  return (
    <>
      <Title order={1} py={30}>
        新しいお医者さんを登録
      </Title>
      <EditPatientContents id={null} />
    </>
  );
};

export default Page;
