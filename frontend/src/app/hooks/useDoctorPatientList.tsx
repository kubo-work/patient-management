import { MRT_ColumnDef } from "mantine-react-table";
import React, { useMemo } from "react";
import { PatientType } from "../../../../common/types/PatientType";
import { sexList } from "../../../constants/sexList";
import Link from "next/link";
import { Button, Flex } from "@mantine/core";

const useDoctorPatientList = () => {
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
          <Flex gap={4}>
            <Link
              href={`/doctor/medical-records?patients_id=${row.original.id}`}
              passHref
              legacyBehavior
            >
              <Button component="a">診察履歴</Button>
            </Link>
            <Link
              href={`/doctor/edit-patient/${row.original.id}`}
              passHref
              legacyBehavior
            >
              <Button component="a">患者情報</Button>
            </Link>
          </Flex>
        ),
        maxSize: 80,
      },
    ],
    []
  );
  return { columns };
};

export default useDoctorPatientList;
