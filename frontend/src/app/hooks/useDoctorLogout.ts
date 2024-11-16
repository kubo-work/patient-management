import { useRouter } from "next/navigation";
import { useGlobalDoctorLogin } from "./useGlobalDoctorLogin";

const useDoctorLogout = () => {
    const router = useRouter();
    const { setIsLogin, logoutAction } = useGlobalDoctorLogin();
    const handleClickLogout = async () => {
        setIsLogin(false);
        logoutAction("");
        router.push('/doctor/login');
    }
    return { handleClickLogout }
}

export default useDoctorLogout
