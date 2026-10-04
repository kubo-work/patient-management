"use client";
import React, { FC } from "react";
import Link from "next/link";
import { Button, Flex } from "@mantine/core";
import usePatientsPage from "./hooks/usePatientsPage";
import TableHeader from "../components/TableHeader";
import DataTable from "../components/dataTable/DataTable";
import { patientsListColumns } from "./patientsListColumns";
import { useSearchParams } from "next/navigation";
import useShowNotification from "../hooks/useShowNotification";
import type { PatientListItemType } from "@/lib/trpc";

const renderPatientActions = (patient: PatientListItemType) => (
  <Flex gap={4}>
    <Button
      component={Link}
      href={`/doctor/medical-records?patients_id=${patient.id}`}
    >
      診察履歴
    </Button>
    <Button component={Link} href={`/doctor/edit-patient/${patient.id}`}>
      患者情報
    </Button>
  </Flex>
);

const PatientsListContents: FC<Record<string, never>> = React.memo(() => {
  const { table } = usePatientsPage();
  const searchParams = useSearchParams();
  useShowNotification(searchParams);
  return (
    <>
      <TableHeader
        url="/doctor/edit-patient"
        textLabel="新しい患者さんを登録"
      />
      <DataTable
        columns={patientsListColumns}
        renderRowActions={renderPatientActions}
        {...table}
      />
    </>
  );
});

PatientsListContents.displayName = "PatientsListContents";

export default PatientsListContents;
