import { useRouter } from "next/navigation";
import { useGlobalDoctorLogin } from "./useGlobalDoctorLogin";
import { API_URL } from "../../../constants/url";

const useDoctorLogout = () => {
    const router = useRouter();
    const { setIsLogin } = useGlobalDoctorLogin();
    const handleClickLogout = async () => {
        await fetch(`${API_URL}/doctor/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: 'include'
        });
        setIsLogin(false);
        router.push('/doctor/login');
    }
    return { handleClickLogout }
}

export default useDoctorLogout
