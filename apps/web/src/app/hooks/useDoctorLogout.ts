import { useRouter } from "next/navigation";
import { useGlobalDoctorLogin } from "./useGlobalDoctorLogin";
import { trpcClient } from "../../lib/trpc";

const useDoctorLogout = () => {
    const router = useRouter();
    const { setIsLogin } = useGlobalDoctorLogin();
    const handleClickLogout = async () => {
        try {
            await trpcClient.doctor.logout.mutate();
        } catch {
            // 移植前も戻り値を読まず常にログイン画面へ戻していた。その挙動を保つ。
        }
        setIsLogin(false);
        router.push('/doctor/login');
    }
    return { handleClickLogout }
}

export default useDoctorLogout
