import DoctorsListContents from "@/app/features/doctor/doctors-list/DoctorsListContents";
import { Title } from "@mantine/core";
import { Metadata } from "next";
import React, { Suspense } from "react";

export const metadata: Metadata = {
  title: "医者一覧",
};

const Page = () => {
  return (
    <>
      <Title order={1} py={30}>
        医者一覧
      </Title>
      <Suspense>
        <DoctorsListContents />
      </Suspense>
    </>
  );
};

export default Page;
