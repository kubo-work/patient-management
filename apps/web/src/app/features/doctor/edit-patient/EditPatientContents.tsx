"use client";

import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { useTRPC } from "@/lib/trpc";
import FetchErrorAlert from "../components/FetchErrorAlert";
import LoadingIndicator from "../components/LoadingIndicator";
import PatientForm from "./PatientForm";

type Props = {
  // null なら新規登録。
  id: number | null;
};

type ExistingPatientFormProps = {
  patientId: number;
};

// 患者を取得してから、その値を初期値にしたフォームを描画する。
const ExistingPatientForm: FC<ExistingPatientFormProps> = ({ patientId }) => {
  const trpc = useTRPC();
  // 取得は、この画面を開いたときの 1 回だけにする。
  // - staleTime: 0 … 開くたびに必ず取り直す。下の isFetchedAfterMount による判定はこれを前提にしている。
  // - refetchOnWindowFocus / refetchOnReconnect: false … フォームの初期値は開いたときの値しか使わないため、
  //   表示後の取り直しは要らない。取り直しが失敗すると、入力中のフォームがエラー表示に替わってしまう。
  const { data: patient, error, isFetchedAfterMount } = useQuery(
    trpc.doctor.patients.byId.queryOptions(
      { patientId },
      { staleTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false }
    )
  );

  if (error) return <FetchErrorAlert error={error} />;
  // フォームの初期値には、キャッシュではなく、この画面を開いてから取得し直した値を使う。
  // 他の画面が同じデータを取得済みだとキャッシュがすぐ返るため、取り直しが済むまで待つ。
  if (!isFetchedAfterMount || patient === undefined) return <LoadingIndicator />;

  return <PatientForm patient={patient} />;
};

const EditPatientContents: FC<Props> = ({ id }) => {
  if (id === null) {
    return <PatientForm patient={null} />;
  }
  return <ExistingPatientForm patientId={id} />;
};

export default EditPatientContents;
