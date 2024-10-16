import { useRouter } from "next/navigation";
import { API_URL } from "../../../constants/url";
import { CookieValueTypes, deleteCookie, getCookie } from "cookies-next";
import { doctorCookieKeyName } from "../../../constants/cookieKey";
import { doctorCookieOptions } from "../../../constants/cookieOption";

const useDoctorLogout = () => {
    const router = useRouter();
    const sid: CookieValueTypes = getCookie(doctorCookieKeyName);
    const loginDoctorAdditionalParam: { sid: CookieValueTypes } = {
        sid,
    };
    const handleClickLogout = async () => {
        const response = await fetch(`${API_URL}/doctor/logout`, {
            method: "POST",
            credentials: 'include',
            headers: {
                Authorization: `Bearer ${loginDoctorAdditionalParam.sid}`,
            }
        })
        if (response) {
            deleteCookie(doctorCookieKeyName, doctorCookieOptions);
            router.push('/doctor/login');
        }
    }
    return { handleClickLogout }
}

export default useDoctorLogout
