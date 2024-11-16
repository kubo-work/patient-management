"use client";
import { MantineReactTable } from "mantine-react-table";
import React, { FC } from "react";
import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";
import useDoctorsList from "@/app/hooks/useDoctorsList";
import { useSearchParams } from "next/navigation";
import { Notifications } from "@mantine/notifications";
import TableHeader from "../components/TableHeader";
import useShowNotification from "@/app/hooks/useShowNotification";

const DoctorsListContents: FC<Record<string, never>> = React.memo(() => {
  const { columns } = useDoctorsList();
  const { doctors } = useGlobalDoctor();
  const searchParams = useSearchParams();
  useShowNotification(searchParams);

  return (
    <>
      <TableHeader
        url="/doctor/edit-doctor"
        textLabel="新しいお医者さんを登録"
      />
      {doctors ? <MantineReactTable columns={columns} data={doctors} /> : ""}
      <Notifications />
    </>
  );
});

DoctorsListContents.displayName = "DoctorListContents";

export default DoctorsListContents;
