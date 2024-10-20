import EditDoctorContents from "@/app/features/doctor/edit-doctor/EditDoctorContents";
import { Title } from "@mantine/core";
import { Metadata } from "next";

type PageParams = {
  params: { doctor_id: string };
};

export const metadata: Metadata = {
  title: "お医者さんを編集",
};

const Page = (params: PageParams) => {
  const { doctor_id } = params.params;
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
