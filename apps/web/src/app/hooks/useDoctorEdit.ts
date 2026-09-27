import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import setShowNotification from '../../../constants/setShowNotification';
import { trpcClient, type DoctorType } from '../../lib/trpc';

type FormValues = {
    name: string;
    email: string;
    password: string;
}

const getDoctorFetcher = (id: number) =>
    trpcClient.doctor.doctors.byId.query({ doctorId: id });

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
            // 更新時のパスワードは任意。空欄なら変更しない（ADR 0005 決定 4）。
            password: (value) => {
                if (id) {
                    return null;
                }
                return value === "" && "パスワードを入力してください。";
            },
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
            // password はサーバから返らなくなった（ADR 0005 決定 6）。
            // 更新時は空欄のままにし、入力があったときだけ送る。
            form.setValues({
                name: doctorData.name,
                email: doctorData.email,
            })
        }
    }, [doctorData])

    const handleSubmit = async (values: FormValues, doMutate: () => void) => {
        setSubmitError("");
        const { name, email, password } = values;

        try {
            if (id) {
                await trpcClient.doctor.doctors.update.mutate({
                    doctorId: id,
                    name,
                    email,
                    // 空欄はパスワードを変更しないという意味なので送らない。
                    // 空文字を送るとサーバがそれをハッシュ化して上書きしてしまう。
                    ...(password !== "" && { password }),
                });
            } else {
                await trpcClient.doctor.doctors.create.mutate({ name, email, password });
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
        router.push(`/doctor/doctors-list?success=${id ? "update" : "new"}`);
    }
    return { form, handleSubmit, submitError }
}

export default useDoctorEdit
