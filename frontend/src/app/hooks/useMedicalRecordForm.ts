import { useEffect, useMemo, useState } from "react";
import { useGlobalDoctor } from "./useGlobalDoctor";
import { useForm } from "@mantine/form";
import { MedicalRecordsType } from "../../../../common/types/MedicalRecordsType";
import { API_URL } from "../../../constants/url";

type PatientNameSuggestionsType = {
    value: string;
    id: string
};

type FormValues = {
    id: string;
    name: string;
    doctor_id: string;
    categories: string[];
    medical_memo: string;
    doctor_memo: string;
}

const useMedicalRecordForm = (name: string, data: MedicalRecordsType | null) => {
    const { patients, loginDoctor, categories, doctors } = useGlobalDoctor();
    const [submitError, setSubmitError] = useState<string>("");
    // 患者の名前をサジェストするためのリストを準備
    const patientNameSuggestions: PatientNameSuggestionsType[] = useMemo(() => {
        return patients ? patients.map(patient => ({
            value: patient.name,
            id: patient.id.toString()
        })) : [];
    }, [patients])

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
            doctor_memo: ""
        }
    })

    const doctorsData = doctors?.map((doctor) => ({
        value: doctor.id.toString(),
        label: doctor.name,
    }));

    useEffect(() => {
        if (data) {
            const getCategories = data
                ? data.categories.map((category) => category.id.toString())
                : [];

            form.setValues({
                id: data.id.toString(),
                categories: getCategories,
                doctor_id: loginDoctor?.id.toString(),
                medical_memo: data.medical_memo,
                doctor_memo: data.doctor_memo
            })
        }
    }, [data])


    const handleSubmit = async (values: FormValues, doMutate: () => void, modalClosed: () => void) => {
        setSubmitError("");
        const { id, name, doctor_id, medical_memo, doctor_memo, categories } = values;
        const patientData = patients?.find((patient) => patient.name === name);
        const patient_id = patientData ? Number(patientData.id) : 0;
        const method = id ? "PUT" : "POST";
        const response = await fetch(`${API_URL}/doctor/medical_records`, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: Number(id),
                doctor_id: Number(doctor_id),
                patient_id,
                medical_memo,
                doctor_memo,
                categories
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();  // サーバーからのエラーメッセージを取得
            setSubmitError(errorData.error);
            alert(submitError);
            return;
        } else {
            setSubmitError("")
            alert("PUT" === method ? "データを更新しました。" : "データを保存しました。")
            doMutate()
            modalClosed();
            return;
        }
    }

    const handleDelete = async (values: FormValues, doMutate: () => void, modalClosed: () => void) => {
        setSubmitError("");
        const { id } = values;
        const response = await fetch(`${API_URL}/doctor/medical_records`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: Number(id),
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();  // サーバーからのエラーメッセージを取得
            setSubmitError(errorData.error);
            alert(submitError);
            return;
        } else {
            setSubmitError("")
            alert("データを削除しました。")
            doMutate()
            modalClosed();
            return;
        }
    }

    return { getName, getPatient, loginDoctor, getCategories, patientNameSuggestions, categories, doctorsData, form, handleSubmit, handleDelete }
}

export default useMedicalRecordForm
