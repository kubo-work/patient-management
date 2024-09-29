"use client";
import useMedicalRecords from "@/app/hooks/useMedicalRecords";
import React, { useMemo } from "react";
import { MantineReactTable, MRT_ColumnDef } from "mantine-react-table";
import { MedicalRecordsType } from "../../../../../../common/types/MedicalRecordsType";
import { Box, Button, Flex, List, ListItem } from "@mantine/core";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

type Props = {
  name: string;
  patients_id: number;
};

dayjs.extend(utc);
dayjs.extend(timezone);

const MedicalRecordsContents = React.memo(({ name, patients_id }: Props) => {
  const { medicalRecord } = useMedicalRecords(patients_id);
  const columns = useMemo<MRT_ColumnDef<MedicalRecordsType>[]>(
    () => [
      {
        accessorKey: "examination_at",
        header: "診察日",
        Cell: ({ row }) => {
          const examination_at: dayjs.Dayjs = dayjs(
            row.original.examination_at
          ).utc();
          const setTimeZone: dayjs.Dayjs = examination_at.tz("Asia/Tokyo");
          const format: string = setTimeZone.format("YY年m月D日 H:i:s");
          return format;
        },
        maxSize: 200,
      },
      {
        accessorKey: "medical_categories",
        header: "施術",
        Cell: ({ row }) => {
          return (
            <List>
              {row.original.medical_categories.map((categories, i) => (
                <ListItem key={i}>{categories.categories.treatment}</ListItem>
              ))}
            </List>
          );
        },
      },
      {
        header: "操作",
        Cell: ({ row }) => (
          <>
            <Button>編集</Button>
          </>
        ),
        maxSize: 80,
      },
    ],
    []
  );
  return (
    <>
      <Box py={30}>
        <Flex justify="center" gap={50}>
          <Button>新しい診察を作成</Button>
          <Button>患者情報を編集</Button>
        </Flex>
      </Box>
      <Box>
        {medicalRecord && (
          <MantineReactTable columns={columns} data={medicalRecord} />
        )}
      </Box>
    </>
  );
});

MedicalRecordsContents.displayName = "MedicalRecordsContents";
export default MedicalRecordsContents;
