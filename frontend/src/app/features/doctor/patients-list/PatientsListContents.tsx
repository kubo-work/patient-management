"use client";
import { MantineReactTable } from "mantine-react-table";
import React, { FC } from "react";
import useDoctorPatientList from "@/app/hooks/useDoctorPatientList";
import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";

const PatientsListContents: FC<Record<string, never>> = React.memo(() => {
  const { columns } = useDoctorPatientList();
  const { patients } = useGlobalDoctor();
  return patients ? (
    <MantineReactTable columns={columns} data={patients} />
  ) : (
    ""
  );
});

PatientsListContents.displayName = "PatientsListContents";

export default PatientsListContents;
