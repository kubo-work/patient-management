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
            // 移植前は fetch に catch が無く、ネットワーク障害時は
            // handleClickLogout 全体が reject して setIsLogin(false) /
            // router.push に到達しなかった。この try/catch はその挙動を
            // 保ったのではなく、常にログイン画面へ戻す挙動を新たに作った。
        }
        setIsLogin(false);
        router.push('/doctor/login');
    }
    return { handleClickLogout }
}

export default useDoctorLogout
