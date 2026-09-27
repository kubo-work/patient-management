"use client";
import React, { FC } from "react";
import useDoctorPatientList from "@/app/hooks/useDoctorPatientList";
import usePatientsPage from "@/app/hooks/usePatientsPage";
import TableHeader from "../components/TableHeader";
import ServerPagedTable from "../components/ServerPagedTable";
import { useSearchParams } from "next/navigation";
import useShowNotification from "@/app/hooks/useShowNotification";
import { Notifications } from "@mantine/notifications";

const PatientsListContents: FC<Record<string, never>> = React.memo(() => {
  const { columns } = useDoctorPatientList();
  const { table } = usePatientsPage();
  const searchParams = useSearchParams();
  useShowNotification(searchParams);
  return (
    <>
      <TableHeader
        url="/doctor/edit-patient"
        textLabel="新しい患者さんを登録"
      />
      <ServerPagedTable columns={columns} {...table} />
      <Notifications />
    </>
  );
});

PatientsListContents.displayName = "PatientsListContents";

export default PatientsListContents;
