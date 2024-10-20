import { MRT_ColumnDef } from "mantine-react-table";
import React, { useMemo } from "react";
import { DoctorType } from "../../../../common/types/DoctorType";
import { Button } from "@mantine/core";
import Link from "next/link";

const useDoctorsList = () => {
  const columns = useMemo<MRT_ColumnDef<DoctorType>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        maxSize: 40,
      },
      {
        accessorKey: "name",
        header: "名前",
        maxSize: 100,
      },
      {
        accessorKey: "email",
        header: "メールアドレス",
      },

      {
        header: "操作",
        Cell: ({ row }) => (
          <Link
            href={`/doctor/edit-doctor/${row.original.id}`}
            passHref
            legacyBehavior
          >
            <Button component="a">編集</Button>
          </Link>
        ),
        maxSize: 80,
      },
    ],
    []
  );
  return { columns };
};

export default useDoctorsList;
