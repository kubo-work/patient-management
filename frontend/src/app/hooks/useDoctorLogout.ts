import { useRouter } from "next/navigation";
import { API_URL } from "../../../constants/url";

const useDoctorLogout = () => {
    const router = useRouter();
    const handleClickLogout = async () => {
        const response = await fetch(`${API_URL}/doctor/logout`, {
            method: "POST",
            credentials: 'include'
        })
        if (response) {
            router.push('/doctor/login');
        }
    }
    return { handleClickLogout }
}

export default useDoctorLogout
