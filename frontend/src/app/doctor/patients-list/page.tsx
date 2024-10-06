"use client";

import { useMemo } from "react";
import { MantineReactTable, type MRT_ColumnDef } from "mantine-react-table";
import Link from "next/link";
import { Button, Title } from "@mantine/core";
import { PatientType } from "@/../../common/types/PatientType";
import { sexList } from "../../../../constants/sexList";
import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";

const Page = () => {
  const { patients } = useGlobalDoctor();

  const columns = useMemo<MRT_ColumnDef<PatientType>[]>(
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
        accessorKey: "sex",
        header: "性別",
        Cell: ({ row }) => sexList[row.original.sex].label,
        maxSize: 40,
      },
      {
        accessorKey: "address",
        header: "住所",
      },

      {
        header: "操作",
        Cell: ({ row }) => (
          <Link
            href={`/doctor/medical_records?patients_id=${row.original.id}`}
            passHref
            legacyBehavior
          >
            <Button component="a">選択</Button>
          </Link>
        ),
        maxSize: 80,
      },
    ],
    []
  );

  return (
    <>
      <Title order={1} py={30}>
        患者一覧
      </Title>
      {patients && <MantineReactTable columns={columns} data={patients} />}
    </>
  );
};

export default Page;
