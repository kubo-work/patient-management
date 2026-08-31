import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { trpcClient } from "../../lib/trpc";

import { useGlobalDoctorLogin } from "./useGlobalDoctorLogin";

type FormValues = {
    email: string;
    password: string;
}

const useDoctorLogin = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setIsLogin } = useGlobalDoctorLogin();
    const [visible, { open, close }] = useDisclosure(false);
    const [loginError, setLoginError] = useState<string>("");
    const status = searchParams.get("status");

    useEffect(() => {
        if (status) {
            if ("error" === status) {
                setLoginError("ログインの有効期限が切れた可能性があります。")
            }
        }
    }, [status])

    const form = useForm({
        initialValues: {
            email: "",
            password: "",
        },

        validate: {
            email: (value) =>
                /^\S+@\S+$/.test(value) ? null : "メールアドレスを入力してください。",
            password: (value) => value === "" && "パスワードを入力してください。",
        },
    });

    const handleLogin = useCallback(async (values: FormValues) => {
        open();
        setLoginError("")
        const { email, password } = values;

        try {
            await trpcClient.doctor.login.mutate({ email, password });
        } catch (error) {
            // tRPC はエラーを throw する。message には移植前と同じ日本語が入る。
            const message = error instanceof Error ? error.message : "ログインに失敗しました。";
            setLoginError(message);
            close();
            return;
        }

        setIsLogin(true);
        router.push('/doctor/patients-list');
    }, [router, open, close, setIsLogin]);

    return { form, handleLogin, loginError, visible }
}

export default useDoctorLogin;
