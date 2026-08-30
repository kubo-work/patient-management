import { useEffect, useState } from "react";
import { PatientType } from "@repo/schema";
import { useForm } from "@mantine/form";
import setShowNotification from "../../../constants/setShowNotification";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { trpcClient } from "../../lib/trpc";

type FormValues = {
    name: string;
    email: string;
    sex: string;
    tel: string;
    address: string;
    birth: Date;
    password?: string;
}

const getPatientFetcher = async (id: number): Promise<PatientType | undefined> =>
    trpcClient.doctor.patients.byId.query({ patientId: id });

const usePatientEdit = (id: number | null) => {
    const router = useRouter();

    const [submitError, setSubmitError] = useState<string>("");
    const [patientData, setPatientData] = useState<PatientType | null>(null);
    const form = useForm({
        initialValues: {
            name: "",
            email: "",
            tel: "",
            sex: "no_answer",
            address: "",
            birth: new Date(),
            ...!id && { password: "" }
        },

        validate: {
            name: (value) => value === "" && "お名前を入力してください。",
            email: (value) =>
                /^\S+@\S+$/.test(value) ? null : "メールアドレスを入力してください。",
            tel: (value) => value === "" && "電話番号を入力してください。",
            address: (value) => value === "" && "住所を入力してください。",
            birth: (value) => {
                if (!value) {
                    return "生年月日を入力してください。";
                }
                const now = dayjs().startOf('minute');
                const selectedTime = dayjs(value).startOf('minute');
                return selectedTime.isAfter(now) ? "未来の日付は選択できません。" : null;
            }
        },
    });

    useEffect(() => {
        const getPatient = async (id: number) => {
            const data = await getPatientFetcher(id);
            data && setPatientData(data)
        }
        id && getPatient(id)
    }, [id])

    useEffect(() => {
        if (patientData) {
            form.setValues({
                name: patientData.name,
                email: patientData.email,
                sex: patientData.sex,
                tel: patientData.tel,
                address: patientData.address,
                birth: patientData.birth ? new Date(patientData.birth) : new Date() //データの読み込みが遅れた場合エラーになるので、ない時は今日の日付を表示しておく
            })
        }
    }, [patientData])

    const handleSubmit = async (values: FormValues, doMutate: () => void) => {
        setSubmitError("");
        const { name, email, sex, tel, address, birth } = values;

        try {
            if (id) {
                await trpcClient.doctor.patients.update.mutate({ id, name, email, sex, tel, address, birth });
            } else {
                await trpcClient.doctor.patients.create.mutate({ name, email, sex, tel, address, birth });
            }
        } catch (error) {
            // tRPC はエラーを throw する。message には移植前と同じ日本語が入る。
            const message = error instanceof Error ? error.message : "データの更新に失敗しました。";
            setSubmitError(message);
            setShowNotification(message, "red");
            return;
        }
        setSubmitError("");
        doMutate();
        router.push(`/doctor/patients-list?success=${id ? "update" : "new"}`);
    }
    return { form, handleSubmit, submitError }
}

export default usePatientEdit
