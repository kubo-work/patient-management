"use client";
import useMedicalRecords from "./hooks/useMedicalRecords";
import React from "react";
import { Box, Button, Flex, Modal } from "@mantine/core";
import MedicalRecordForm from "./MedicalRecordForm";
import DataTable from "../components/dataTable/DataTable";
import { medicalRecordsColumns } from "./medicalRecordsColumns";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { MedicalRecordType, PatientType } from "@/lib/trpc";

type Props = {
  patientData: PatientType;
  patients_id: number;
};

dayjs.extend(utc);
dayjs.extend(timezone);

const NEW_RECORD_FORM_KEY = "new";

const MedicalRecordsContents = React.memo(
  ({ patientData, patients_id }: Props) => {
    const {
      table,
      selectedRecord,
      setSelectedRecord,
      isNewRecord,
      setIsNewRecord,
    } = useMedicalRecords(patients_id);

    // 選択した診察を編集モーダルで開く。state を更新するため、コンポーネントの中で定義する。
    const renderMedicalRecordActions = (medicalRecord: MedicalRecordType) => (
      <Button
        onClick={() => {
          setIsNewRecord(false);
          setSelectedRecord(medicalRecord);
        }}
      >
        編集
      </Button>
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
          size="lg"
        >
          {(selectedRecord || isNewRecord) && (
            <MedicalRecordForm
              // 開く診察が変わったら作り直し、その診察の値を初期値にする。
              key={selectedRecord?.id ?? NEW_RECORD_FORM_KEY}
              name={patientData.name}
              patientId={patients_id}
              data={selectedRecord}
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
          <DataTable
            columns={medicalRecordsColumns}
            renderRowActions={renderMedicalRecordActions}
            {...table}
          />
        </Box>
      </>
    );
  }
);

MedicalRecordsContents.displayName = "MedicalRecordsContents";
export default MedicalRecordsContents;
