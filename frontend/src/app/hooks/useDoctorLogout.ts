import { useRouter } from "next/navigation";
import { useGlobalDoctorLogin } from "./useGlobalDoctorLogin";
import { API_URL } from "../../../constants/url";

const useDoctorLogout = () => {
    const router = useRouter();
    const { setIsLogin, logoutAction } = useGlobalDoctorLogin();
    const handleClickLogout = async () => {
        await fetch(`${API_URL}/doctor/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: 'include'
        });
        setIsLogin(false);
        logoutAction("");
        router.push('/doctor/login');
    }
    return { handleClickLogout }
}

export default useDoctorLogout
