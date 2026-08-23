import EditDoctorContents from "@/app/features/doctor/edit-doctor/EditDoctorContents";
import { Title } from "@mantine/core";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "新しいお医者さんを登録",
};

const Page = () => {
  return (
    <>
      <Title order={1} py={30}>
        新しいお医者さんを登録
      </Title>
      <EditDoctorContents id={null} />
    </>
  );
};

export default Page;
