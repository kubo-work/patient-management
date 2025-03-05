import { useForm } from '@mantine/form';
import { DoctorType } from '../../../../common/types/DoctorType';
import { useEffect, useState } from 'react';
import { API_URL } from '../../../constants/url';
import { useRouter } from 'next/navigation';
import setShowNotification from '../../../constants/setShowNotification';

type FormValues = {
    name: string;
    email: string;
    password: string;
}

const getDoctorFetcher = async (id: number): Promise<DoctorType | undefined> => (
    await fetch(`${API_URL}/doctor/doctors/${id}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",

    }).then((res) => res.json())
)

const useDoctorEdit = (id: number | null) => {
    const router = useRouter();

    const [submitError, setSubmitError] = useState<string>("");
    const [doctorData, setDoctorData] = useState<DoctorType | null>(null);
    const form = useForm({
        initialValues: {
            name: "",
            email: "",
            password: "",
        },

        validate: {
            name: (value) => value === "" && "お名前を入力してください。",
            email: (value) =>
                /^\S+@\S+$/.test(value) ? null : "メールアドレスを入力してください。",
            password: (value) => value === "" && "パスワードを入力してください。",
        },
    });

    useEffect(() => {
        const getDoctor = async (id: number) => {
            const data = await getDoctorFetcher(id)
            data && setDoctorData(data)
        }
        id && getDoctor(id)
    }, [id])

    useEffect(() => {
        if (doctorData) {
            form.setValues({
                name: doctorData.name,
                email: doctorData.email,
                password: doctorData.password,
            })
        }
    }, [doctorData])

    const handleSubmit = async (values: FormValues, doMutate: () => void) => {
        setSubmitError("");
        const { name, email, password } = values;
        const method = id ? "PUT" : "POST";
        const fetchUrl = id ? `${API_URL}/doctor/doctors/${id}` : `${API_URL}/doctor/doctors`
        const response = await fetch(fetchUrl, {
            method,
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                name,
                email,
                password,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();  // サーバーからのエラーメッセージを取得
            setSubmitError(errorData.error);
            setShowNotification(submitError, "red")
            return;
        } else {
            setSubmitError("");
            doMutate();
            router.push(`/doctor/doctors-list?success=${method === "PUT" ? "update" : "new"}`)
        }
    }
    return { form, handleSubmit, submitError }
}

export default useDoctorEdit
