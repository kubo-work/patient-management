"use client";
import { MantineReactTable } from "mantine-react-table";
import React, { FC } from "react";
import useDoctorPatientList from "@/app/hooks/useDoctorPatientList";
import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";
import TableHeader from "../components/TableHeader";
import { useSearchParams } from "next/navigation";
import useShowNotification from "@/app/hooks/useShowNotification";
import { Notifications } from "@mantine/notifications";

const PatientsListContents: FC<Record<string, never>> = React.memo(() => {
  const { columns } = useDoctorPatientList();
  const { patients } = useGlobalDoctor();
  const searchParams = useSearchParams();
  useShowNotification(searchParams);
  return (
    <>
      <TableHeader
        url="/doctor/edit-patient"
        textLabel="新しい患者さんを登録"
      />
      {patients ? (
        <MantineReactTable
          columns={columns}
          data={patients}
          initialState={{ sorting: [{ id: "id", desc: false }] }}
        />
      ) : (
        ""
      )}
      <Notifications />
    </>
  );
});

PatientsListContents.displayName = "PatientsListContents";

export default PatientsListContents;
