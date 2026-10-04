import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "../../../../../lib/trpc";
import { useGlobalDoctorLogin } from "../../hooks/useGlobalDoctorLogin";

type FormValues = {
    email: string;
    password: string;
}

// 認証の期限切れなどでログイン画面へ戻されたときに、URL に付く値。
const SESSION_EXPIRED_STATUS = "error";
const SESSION_EXPIRED_MESSAGE = "ログインの有効期限が切れた可能性があります。";

const useDoctorLogin = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const trpc = useTRPC();
    const { setIsLogin } = useGlobalDoctorLogin();

    const form = useForm<FormValues>({
        initialValues: {
            email: "",
            password: "",
        },

        validate: {
            email: (value) =>
                /^\S+@\S+$/.test(value) ? null : "メールアドレスを入力してください。",
            password: (value) => value === "" && "パスワードを入力してください。",
        },
    });

    const loginMutation = useMutation(
        trpc.doctor.login.mutationOptions({
            onSuccess: () => {
                setIsLogin(true);
                router.push('/doctor/patients-list');
            },
        })
    );

    // tRPC はエラーを throw する。message には移植前と同じ日本語が入る。
    // 期限切れの案内は、ログインを試す前（isIdle）だけ表示する。
    const getLoginError = (): string => {
        if (loginMutation.error) {
            return loginMutation.error.message;
        }
        if (loginMutation.isIdle && searchParams.get("status") === SESSION_EXPIRED_STATUS) {
            return SESSION_EXPIRED_MESSAGE;
        }
        return "";
    };

    const handleLogin = (values: FormValues): void => {
        loginMutation.mutate(values);
    };

    return {
        form,
        handleLogin,
        loginError: getLoginError(),
        // 成功後も、患者一覧へ遷移し終えるまで読み込み中の表示を続ける。
        isLoggingIn: loginMutation.isPending || loginMutation.isSuccess,
    }
}

export default useDoctorLogin;
