import { Title } from "@mantine/core";
import PatientsListContents from "@/app/features/doctor/patients-list/PatientsListContents";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "患者一覧",
};
const Page = () => {
  return (
    <>
      <Title order={1} py={30}>
        患者一覧
      </Title>
      <Suspense>
        <PatientsListContents />
      </Suspense>
    </>
  );
};

export default Page;
