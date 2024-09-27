"use client";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css"; //if using mantine date picker features
import "mantine-react-table/styles.css"; //make sure MRT styles were imported in your app root (once)
import { useEffect, useMemo } from "react";
import { MantineReactTable, type MRT_ColumnDef } from "mantine-react-table";
import Link from "next/link";
import { Button, Title } from "@mantine/core";
import { usePatientsList } from "@/app/hooks/usePatientsList";
import { PatientType } from "@/../../common/types/PatientType";
import { sexList } from "../../../../constants/sexList";

const Page = () => {
  const { data, patients, setPatients } = usePatientsList();

  useEffect(() => {
    data && setPatients(data);
  }, [data, setPatients]);

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
