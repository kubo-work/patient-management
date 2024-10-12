import { useRouter } from "next/navigation";
import { API_URL } from "../../../constants/url";
import { useState } from "react";

type FormValues = {
    email: string;
    password: string;
}

export const useDoctorLogin = () => {
    const router = useRouter();
    const [loginError, setLoginError] = useState<string>("");
    const handleLogin = async (values: FormValues) => {
        setLoginError("")
        const { email, password } = values;
        const response = await fetch(`${API_URL}/doctor/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            }),
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();  // サーバーからのエラーメッセージを取得
            setLoginError(errorData.error);
            return;
        } else {
            router.push('/doctor/dashboard');  // ダッシュボードページに遷移
        }
    }
    return { handleLogin, loginError }
}

export const config = {
    matcher: ['/doctor/:path*'],
};
