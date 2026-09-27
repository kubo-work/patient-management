"use client";
import useMedicalRecords from "@/app/hooks/useMedicalRecords";
import React from "react";
import { Box, Button, Flex, Modal } from "@mantine/core";
import MedicalRecordForm from "../components/MedicalRecordForm";
import ServerPagedTable from "../components/ServerPagedTable";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { PatientType } from "@repo/schema";
import { Notifications } from "@mantine/notifications";

type Props = {
  patientData: PatientType;
  patients_id: number;
};

dayjs.extend(utc);
dayjs.extend(timezone);

const MedicalRecordsContents = React.memo(
  ({ patientData, patients_id }: Props) => {
    const {
      table,
      selectedRecord,
      revalidateMedicalRecords,
      setSelectedRecord,
      isNewRecord,
      setIsNewRecord,
      columns,
    } = useMedicalRecords(patients_id);

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
          size="lg"
        >
          {(selectedRecord || isNewRecord) && (
            <MedicalRecordForm
              name={patientData.name}
              patientId={patients_id}
              data={selectedRecord || null}
              mutate={revalidateMedicalRecords}
              modalClosed={() => {
                setSelectedRecord(null);
                setIsNewRecord(false);
              }}
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
          <ServerPagedTable columns={columns} {...table} />
        </Box>
        <Notifications />
      </>
    );
  }
);

MedicalRecordsContents.displayName = "MedicalRecordsContents";
export default MedicalRecordsContents;
