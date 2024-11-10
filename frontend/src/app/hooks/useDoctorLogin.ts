import { useRouter } from "next/navigation";
import { API_URL } from "../../../constants/url";
import { useCallback, useState } from "react";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { setCookie } from "cookies-next";
import { doctorCookieKeyName } from "../../../constants/cookieKey";
import { doctorCookieOptions } from "../../../constants/cookieOption";
import { useGlobalDoctorLogin } from "./useGlobalDoctorLogin";

type FormValues = {
    email: string;
    password: string;
}

const useDoctorLogin = () => {
    const router = useRouter();
    const { setIsLogin } = useGlobalDoctorLogin();
    const [visible, { open, close }] = useDisclosure(false);
    const [loginError, setLoginError] = useState<string>("");

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
        const response = await fetch(`${API_URL}/doctor/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password
            }),
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            setLoginError(errorData.error);
            close();
            return;
        } else {
            const data = await response.json()
            localStorage.setItem('token', data.token);
            setCookie(doctorCookieKeyName, data.token, doctorCookieOptions);
            setIsLogin(true);
            router.push('/doctor/patients-list');
        }
    }, [router, open, close, setIsLogin]);

    return { form, handleLogin, loginError, visible }
}

export default useDoctorLogin;
