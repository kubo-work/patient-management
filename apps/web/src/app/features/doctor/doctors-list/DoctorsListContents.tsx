"use client";
import React, { FC } from "react";
import Link from "next/link";
import { Button } from "@mantine/core";
import type { DoctorType } from "@/lib/trpc";
import useDoctorsPage from "@/app/hooks/useDoctorsPage";
import { useSearchParams } from "next/navigation";
import TableHeader from "../components/TableHeader";
import DataTable from "../components/dataTable/DataTable";
import { doctorsListColumns } from "./doctorsListColumns";
import useShowNotification from "@/app/hooks/useShowNotification";

const renderDoctorActions = (doctor: DoctorType) => (
  <Button component={Link} href={`/doctor/edit-doctor/${doctor.id}`}>
    編集
  </Button>
);

const DoctorsListContents: FC<Record<string, never>> = React.memo(() => {
  const { table } = useDoctorsPage();
  const searchParams = useSearchParams();
  useShowNotification(searchParams);

  return (
    <>
      <TableHeader
        url="/doctor/edit-doctor"
        textLabel="新しいお医者さんを登録"
      />
      <DataTable
        columns={doctorsListColumns}
        renderRowActions={renderDoctorActions}
        {...table}
      />
    </>
  );
});

DoctorsListContents.displayName = "DoctorListContents";

export default DoctorsListContents;
