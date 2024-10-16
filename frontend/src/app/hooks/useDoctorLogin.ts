import { useRouter } from "next/navigation";
import { API_URL } from "../../../constants/url";
import { useState } from "react";
import { doctorCookieKeyName } from "../../../constants/cookieKey";
import { setCookie } from "cookies-next";
import { doctorCookieOptions } from "../../../constants/cookieOption";

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
            const errorData = await response.json();
            setLoginError(errorData.error);
            return;
        } else {
            const data = await response.json()
            setCookie(doctorCookieKeyName, data.sessionId, doctorCookieOptions);
            router.push('/doctor/dashboard');
        }
    }
    return { handleLogin, loginError }
}
