"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalDoctor } from "./useGlobalDoctor";
import { useForm } from "@mantine/form";
import dayjs from "dayjs";
import setShowNotification from "../../../constants/setShowNotification";
import { trpcClient, type MedicalRecordType } from "../../lib/trpc";

type FormValues = {
    id: string;
    // 未選択は null。Mantine 9 から Select が数値の値を扱えるため、ID を文字列へ変換しない。
    doctor_id: number | null;
    categories: string[];
    examination_at: Date;
    medical_memo: string;
    doctor_memo: string;
}

const DOCTOR_NOT_SELECTED_MESSAGE = "選択してください。";

// patientId は診察履歴画面の URL（patients_id）で確定している患者。
// 以前は患者名で全患者から探していたため、同じ名前の患者がいると別の患者の診察として保存された。
const useMedicalRecordForm = (patientId: number, data: MedicalRecordType | null) => {
    const { loginDoctor, categories, doctors } = useGlobalDoctor();
    const [submitError, setSubmitError] = useState<string>("");

    const form = useForm<FormValues>({
        initialValues: {
            id: "",
            doctor_id: null,
            categories: [],
            medical_memo: "",
            doctor_memo: "",
            examination_at: new Date()
        },
        validate: {
            doctor_id: (value) => value === null ? DOCTOR_NOT_SELECTED_MESSAGE : null,
            categories: (value) => value.length > 0 ? null : "少なくとも1つのカテゴリを選択してください",
            // 診察日は空にできない（初期値が必ず入り、入力欄は空への変更を受け付けない）ため、未来の日時だけを確かめる。
            examination_at: (value) => {
                const now = dayjs().startOf('minute');
                const selectedTime = dayjs(value).startOf('minute');
                return selectedTime.isAfter(now) ? "未来の日時は選択できません。" : null;
            }
        },
    })

    const doctorsData = useMemo(() =>
    (doctors?.map((doctor) => ({
        value: doctor.id,
        label: doctor.name,
    }))), [doctors]);

    useEffect(() => {
        if (data) {
            const selectedCategoryIds = data.categories.map((category) => category.id.toString());
            form.setValues({
                id: data.id.toString(),
                categories: selectedCategoryIds,
                doctor_id: data.doctor_id,
                medical_memo: data.medical_memo,
                doctor_memo: data.doctor_memo,
                examination_at: new Date(data.examination_at)
            })
        } else {
            form.setValues({
                id: "",
                doctor_id: loginDoctor?.id ?? null,
                categories: [],
                medical_memo: "",
                doctor_memo: "",
                examination_at: new Date()
            })
        }
    }, [loginDoctor, data])


    // form は描画のたびに新しいオブジェクトになるため、参照が変わらない setFieldError だけを取り出して使う。
    const { setFieldError } = form;

    const handleSubmit = useCallback(async (values: FormValues, doMutate: () => void, modalClosed: () => void) => {
        setSubmitError("");

        const { id, doctor_id, examination_at, medical_memo, doctor_memo, categories } = values;
        const isUpdate = Boolean(id);
        // 検証（validate）を通っていれば null にはならない。型の上で null を除くために確かめる。
        // 到達した場合も、検証のときと同じく担当者の欄にエラーを出す。
        if (doctor_id === null) {
            setFieldError("doctor_id", DOCTOR_NOT_SELECTED_MESSAGE);
            return;
        }

        try {
            if (isUpdate) {
                await trpcClient.doctor.medicalRecords.update.mutate({
                    id: Number(id),
                    patient_id: patientId,
                    doctor_id,
                    medical_memo,
                    doctor_memo,
                    examination_at,
                    categories,
                });
            } else {
                await trpcClient.doctor.medicalRecords.create.mutate({
                    patient_id: patientId,
                    doctor_id,
                    medical_memo,
                    doctor_memo,
                    examination_at,
                    categories,
                });
            }
        } catch (error) {
            // tRPC はエラーを throw する。message には移植前と同じ日本語が入る。
            const message = error instanceof Error ? error.message : "データの更新に失敗しました。";
            setSubmitError(message);
            setShowNotification(message, "red");
            return;
        }

        setSubmitError("")
        doMutate()
        modalClosed();
        setShowNotification(isUpdate ? "診察を更新しました。" : "診察を保存しました。", "orange");
    }, [patientId, setFieldError])

    const handleDelete = useCallback(async (id: number, doMutate: () => void, modalClosed: () => void) => {
        setSubmitError("");
        const result = window.confirm("削除しますか？");
        if (!result) return;

        try {
            await trpcClient.doctor.medicalRecords.remove.mutate({ id });
        } catch (error) {
            const message = error instanceof Error ? error.message : "データの削除に失敗しました。";
            setSubmitError(message);
            setShowNotification(message, "red");
            return;
        }

        setSubmitError("")
        setShowNotification("診察を削除しました。", "orange")
        doMutate()
        modalClosed();
    }, [])

    return { categories, doctorsData, form, handleSubmit, handleDelete, submitError }
}

export default useMedicalRecordForm
