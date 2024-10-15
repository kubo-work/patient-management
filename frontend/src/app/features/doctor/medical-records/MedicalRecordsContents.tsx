"use client";
import useMedicalRecords from "@/app/hooks/useMedicalRecords";
import React, { useMemo } from "react";
import { MantineReactTable, MRT_ColumnDef } from "mantine-react-table";
import { MedicalRecordsType } from "../../../../../../common/types/MedicalRecordsType";
import { Box, Button, Flex, List, ListItem, Modal } from "@mantine/core";
import MedicalRecordForm from "../components/MedicalRecordForm";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { PatientType } from "../../../../../../common/types/PatientType";

type Props = {
  patientData: PatientType;
  patients_id: number;
};

dayjs.extend(utc);
dayjs.extend(timezone);

const MedicalRecordsContents = React.memo(
  ({ patientData, patients_id }: Props) => {
    const {
      medicalRecord,
      selectedRecord,
      patientMutate,
      setSelectedRecord,
      isNewRecord,
      setIsNewRecord,
    } = useMedicalRecords(patients_id);
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
    return (
      <>
        {/* 診察編集モーダル */}
        <Modal
          opened={selectedRecord !== null || isNewRecord} // モーダルの開閉状態を診察データで管理
          onClose={() => {
            setSelectedRecord(null);
            setIsNewRecord(false);
          }} // モーダルを閉じるときはnullに戻す
          title={isNewRecord ? "新しい診察を作成" : "診察編集"}
          keepMounted
        >
          {(selectedRecord || isNewRecord) && (
            <MedicalRecordForm
              name={patientData.name}
              data={selectedRecord || null}
              mutate={patientMutate}
              modalClosed={() => setSelectedRecord(null)}
            />
          )}
        </Modal>

        <Box py={30}>
          <Flex justify="center" gap={50}>
            <Button
              onClick={() => {
                setSelectedRecord(null);
                setIsNewRecord(true);
              }}
            >
              新しい診察を作成
            </Button>
          </Flex>
        </Box>
        <Box>
          {medicalRecord && (
            <MantineReactTable columns={columns} data={medicalRecord} />
          )}
        </Box>
      </>
    );
  }
);

MedicalRecordsContents.displayName = "MedicalRecordsContents";
export default MedicalRecordsContents;
