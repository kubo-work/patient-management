import { deleteCookie } from "cookies-next";
import { useRouter } from "next/navigation";
import { doctorCookieKeyName } from "../../../constants/cookieKey";
import { doctorCookieOptions } from "../../../constants/cookieOption";
import { useGlobalDoctorLogin } from "./useGlobalDoctorLogin";

const useDoctorLogout = () => {
    const router = useRouter();
    const { setIsLogin } = useGlobalDoctorLogin();
    const handleClickLogout = async () => {
        deleteCookie(doctorCookieKeyName, doctorCookieOptions);
        setIsLogin(false);
        localStorage.removeItem('token');
        router.push('/doctor/login');
    }
    return { handleClickLogout }
}

export default useDoctorLogout
