"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalDoctor } from "./useGlobalDoctor";
import { useForm } from "@mantine/form";
import { MedicalRecordsType } from "../../../../common/types/MedicalRecordsType";
import { API_URL } from "../../../constants/url";
import dayjs from "dayjs";
import setShowNotification from "../../../constants/setShowNotification";

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

    const showErrorMessage = useCallback(async (response: Response) => {
        const errorData = await response.json();
        setSubmitError(errorData.error);
        return setShowNotification(submitError, "red");
    }, [submitError])

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
        const method = id ? "PUT" : "POST";
        const response = await fetch(`${API_URL}/doctor/medical_records`, {
            method,
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                id: id ? Number(id) : 0,
                doctor_id: Number(doctor_id),
                patient_id,
                medical_memo,
                doctor_memo,
                examination_at,
                categories
            }),
        });

        if (!response.ok) {
            showErrorMessage(response)
            return;
        } else {
            setSubmitError("")
            doMutate()
            modalClosed();
            let message = "";
            if ("PUT" === method) {
                message = "診察を更新しました。";
            } else if ("POST" === method) {
                message = "診察を保存しました。";
            }
            message && setShowNotification(message, "orange");
            return;
        }
    }, [patients, showErrorMessage])

    const handleDelete = useCallback(async (id: number, doMutate: () => void, modalClosed: () => void) => {
        setSubmitError("");
        const result = window.confirm("削除しますか？");
        if (result) {
            const response = await fetch(`${API_URL}/doctor/medical_records`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                }),
                credentials: 'include'
            });
            if (!response.ok) {
                showErrorMessage(response);
                return;
            } else {
                setSubmitError("")
                setShowNotification("診察を削除しました。", "orange")
                doMutate()
                modalClosed();
                return;
            }
        }
    }, [showErrorMessage])

    return { getName, getPatient, loginDoctor, getCategories, categories, doctorsData, form, handleSubmit, handleDelete, submitError }
}

export default useMedicalRecordForm
