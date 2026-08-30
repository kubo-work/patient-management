import useSWR from "swr";
import { MedicalRecordsType } from "@repo/schema";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Button, List, ListItem } from "@mantine/core";
import { MRT_ColumnDef } from "mantine-react-table";
import { trpcClient } from "../../lib/trpc";

dayjs.extend(utc);
dayjs.extend(timezone);

const getMedicalRecordsFetcher = async (
  patientsId: number
): Promise<MedicalRecordsType[]> =>
  trpcClient.doctor.medicalRecords.byPatient.query({ patientId: patientsId });

const useMedicalRecords = (patients_id: number) => {
  const [medicalRecord, setMedicalRecord] = useState<
    MedicalRecordsType[] | null
  >([]);

  const [selectedRecord, setSelectedRecord] =
    useState<MedicalRecordsType | null>(null);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  const {
    data,
    isLoading,
    error,
    mutate: patientMutate,
  } = useSWR(["medical-records", patients_id], () =>
    getMedicalRecordsFetcher(patients_id)
  );
  useEffect(() => {
    data && setMedicalRecord(data);
  }, [data, setMedicalRecord]);

  const columns = useMemo<MRT_ColumnDef<MedicalRecordsType>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        maxSize: 50,
      },
      {
        accessorKey: "examination_at",
        header: "診察日",
        Cell: ({ row }) => {
          const examination_at: dayjs.Dayjs = dayjs(
            row.original.examination_at
          ).utc();
          const setTimeZone: dayjs.Dayjs = examination_at.tz("Asia/Tokyo");
          const format: string = setTimeZone.format("YYYY年M月D日 H:mm");
          return format;
        },
        maxSize: 200,
      },
      {
        accessorKey: "category",
        header: "施術",
        Cell: ({ row }) => (
          <List>
            {row.original.categories.map((category, i) => (
              <ListItem key={i}>{category.treatment}</ListItem>
            ))}
          </List>
        ),
      },
      {
        header: "操作",
        Cell: ({ row }) => (
          <>
            <Button
              onClick={() => {
                setIsNewRecord(false);
                setSelectedRecord(row.original);
              }}
            >
              編集
            </Button>
          </>
        ),
        maxSize: 80,
      },
    ],
    [setIsNewRecord, setSelectedRecord]
  );

  return {
    medicalRecord,
    isLoading,
    error,
    patientMutate,
    selectedRecord,
    setSelectedRecord,
    isNewRecord,
    setIsNewRecord,
    columns,
  };
};

export default useMedicalRecords;
