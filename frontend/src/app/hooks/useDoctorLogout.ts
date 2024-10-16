import { useRouter } from "next/navigation";
import { API_URL } from "../../../constants/url";
import { CookieValueTypes, getCookie } from "cookies-next";
import { doctorCookieName } from "../../../../common/util/CookieName";
const useDoctorLogout = () => {
    const router = useRouter();
    const sid: CookieValueTypes = getCookie(doctorCookieName);
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
            router.push('/doctor/login');
        }
    }
    return { handleClickLogout }
}

export default useDoctorLogout
