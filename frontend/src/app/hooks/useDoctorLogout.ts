import { deleteCookie } from "cookies-next";
import { useRouter } from "next/navigation";
import { doctorCookieKeyName } from "../../../constants/cookieKey";
import { doctorCookieOptions } from "../../../constants/cookieOption";

const useDoctorLogout = () => {
    const router = useRouter();
    const handleClickLogout = async () => {
        deleteCookie(doctorCookieKeyName, doctorCookieOptions);
        localStorage.removeItem('token');
        router.push('/doctor/login');
    }
    return { handleClickLogout }
}

export default useDoctorLogout
