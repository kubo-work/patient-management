"use client";
import React, { FC } from "react";
import useDoctorsPage from "@/app/hooks/useDoctorsPage";
import useDoctorsList from "@/app/hooks/useDoctorsList";
import { useSearchParams } from "next/navigation";
import { Notifications } from "@mantine/notifications";
import TableHeader from "../components/TableHeader";
import ServerPagedTable from "../components/ServerPagedTable";
import useShowNotification from "@/app/hooks/useShowNotification";

const DoctorsListContents: FC<Record<string, never>> = React.memo(() => {
  const { columns } = useDoctorsList();
  const { table } = useDoctorsPage();
  const searchParams = useSearchParams();
  useShowNotification(searchParams);

  return (
    <>
      <TableHeader
        url="/doctor/edit-doctor"
        textLabel="新しいお医者さんを登録"
      />
      <ServerPagedTable columns={columns} {...table} />
      <Notifications />
    </>
  );
});

DoctorsListContents.displayName = "DoctorListContents";

export default DoctorsListContents;
