import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../../../../lib/trpc";
import { useGlobalDoctorLogin } from "../../hooks/useGlobalDoctorLogin";

const useDoctorLogout = () => {
    const router = useRouter();
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { setIsLogin } = useGlobalDoctorLogin();

    const logoutMutation = useMutation(
        trpc.doctor.logout.mutationOptions({
            // 通信に失敗しても、常にログイン画面へ戻す。
            // 移植前（REST の fetch）は失敗するとログイン画面へ戻れなかったため、
            // tRPC へ移したときにこの挙動へ変えている。
            onSettled: () => {
                setIsLogin(false);
                // 次にログインした医師に、前の医師が取得したデータを見せない。
                queryClient.clear();
                router.push('/doctor/login');
            },
        })
    );

    const handleClickLogout = (): void => {
        logoutMutation.mutate();
    };

    return { handleClickLogout }
}

export default useDoctorLogout
