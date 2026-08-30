"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalDoctor } from "./useGlobalDoctor";
import { useForm } from "@mantine/form";
import { MedicalRecordsType } from "@repo/schema";
import dayjs from "dayjs";
import setShowNotification from "../../../constants/setShowNotification";
import { trpcClient } from "../../lib/trpc";

type FormValues = {
    id: string;
    name: string;
    doctor_id: string;
    categories: string[];
    examination_at: Date;
    medical_memo: string;
    doctor_memo: string;
}

const useMedicalRecordForm = (name: string, data: MedicalRecordsType | null) => {
    const { patients, loginDoctor, categories, doctors } = useGlobalDoctor();
    const [submitError, setSubmitError] = useState<string>("");

    const getName: string = name;
    const getPatient = patients ? patients?.find((patient) => patient.name === getName) : null;

    const getCategories = data
        ? data.categories.map((category) => category.id.toString())
        : [];

    const form = useForm({
        initialValues: {
            id: "",
            name,
            doctor_id: "",
            categories: [""],
            medical_memo: "",
            doctor_memo: "",
            examination_at: new Date()
        },
        validate: {
            name: (value) => value ? null : "選択してください。",
            doctor_id: (value) => value ? null : "選択してください。",
            categories: (value) => value.length > 0 ? null : "少なくとも1つのカテゴリを選択してください",
            examination_at: (value) => {
                if (!value) {
                    return "日時を選択してください。";
                }
                const now = dayjs().startOf('minute');
                const selectedTime = dayjs(value).startOf('minute');
                return selectedTime.isAfter(now) ? "未来の日時は選択できません。" : null;
            }
        },
    })

    const doctorsData = useMemo(() =>
    (doctors?.map((doctor) => ({
        value: doctor.id.toString(),
        label: doctor.name,
    }))), [doctors]);

    useEffect(() => {
        if (data) {
            const getCategories = data
                ? data.categories.map((category) => category.id.toString())
                : [];
            form.setValues({
                id: data.id.toString(),
                categories: getCategories,
                doctor_id: data?.doctor_id.toString(),
                medical_memo: data.medical_memo,
                doctor_memo: data.doctor_memo,
                examination_at: new Date(data.examination_at)
            })
        } else {
            form.setValues({
                id: "",
                name,
                doctor_id: loginDoctor?.id.toString(),
                categories: [],
                medical_memo: "",
                doctor_memo: "",
                examination_at: new Date()
            })
        }
    }, [loginDoctor, name, data])


    const handleSubmit = useCallback(async (values: FormValues, doMutate: () => void, modalClosed: () => void) => {
        setSubmitError("");

        const { id, name, doctor_id, examination_at, medical_memo, doctor_memo, categories } = values;
        const patientData = patients?.find((patient) => patient.name === name);
        const patient_id = patientData ? Number(patientData.id) : 0;
        const isUpdate = Boolean(id);

        try {
            if (isUpdate) {
                await trpcClient.doctor.medicalRecords.update.mutate({
                    id: Number(id),
                    patient_id,
                    doctor_id: Number(doctor_id),
                    medical_memo,
                    doctor_memo,
                    examination_at,
                    categories,
                });
            } else {
                await trpcClient.doctor.medicalRecords.create.mutate({
                    patient_id,
                    doctor_id: Number(doctor_id),
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
    }, [patients])

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

    return { getName, getPatient, loginDoctor, getCategories, categories, doctorsData, form, handleSubmit, handleDelete, submitError }
}

export default useMedicalRecordForm
