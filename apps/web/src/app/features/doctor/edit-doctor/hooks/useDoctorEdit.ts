import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import setShowNotification from '../../../../../../constants/setShowNotification';
import { useTRPC, type DoctorType } from '../../../../../lib/trpc';

type FormValues = {
    name: string;
    email: string;
    password: string;
}

// 一覧画面は、この値に応じた通知を出す（useShowNotification）。
type SaveResult = "new" | "update";

// doctor が null なら新規登録、取得済みの医師なら更新のフォームになる。
const useDoctorEdit = (doctor: DoctorType | null) => {
    const router = useRouter();
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const form = useForm<FormValues>({
        // password はサーバから返らない（ADR 0005 決定 6）。
        // 更新時は空欄のままにし、入力があったときだけ送る。
        initialValues: {
            name: doctor?.name ?? "",
            email: doctor?.email ?? "",
            password: "",
        },

        validate: {
            name: (value) => value === "" && "お名前を入力してください。",
            email: (value) =>
                /^\S+@\S+$/.test(value) ? null : "メールアドレスを入力してください。",
            // 更新時のパスワードは任意。空欄なら変更しない（ADR 0005 決定 4）。
            password: (value) => {
                if (doctor !== null) {
                    return null;
                }
                return value === "" && "パスワードを入力してください。";
            },
        },
    });

    // 医師の一覧・全件・1 件取得の結果を古い扱いにしてから、一覧へ戻る。一覧は表示時に取り直す。
    // refetchType: "none" で、表示中のこの編集画面の取得は取り直させない（EditDoctorContents）。
    const returnToList = (saveResult: SaveResult): void => {
        void queryClient.invalidateQueries({
            ...trpc.doctor.doctors.pathFilter(),
            refetchType: "none",
        });
        // 自分の情報を変えた場合に、ヘッダーの医師名も取り直す。
        void queryClient.invalidateQueries(trpc.doctor.loginDoctor.queryFilter());
        router.push(`/doctor/doctors-list?success=${saveResult}`);
    };

    // tRPC はエラーを throw する。message には移植前と同じ日本語が入る。
    const notifyError = (error: { message: string }): void => {
        setShowNotification(error.message, "red");
    };

    const createMutation = useMutation(
        trpc.doctor.doctors.create.mutationOptions({
            onSuccess: () => returnToList("new"),
            onError: notifyError,
        })
    );
    const updateMutation = useMutation(
        trpc.doctor.doctors.update.mutationOptions({
            onSuccess: () => returnToList("update"),
            onError: notifyError,
        })
    );

    const handleSubmit = ({ name, email, password }: FormValues): void => {
        if (doctor === null) {
            createMutation.mutate({ name, email, password });
            return;
        }
        updateMutation.mutate({
            doctorId: doctor.id,
            name,
            email,
            // 空欄はパスワードを変更しないという意味なので送らない。
            // 空文字を送るとサーバがそれをハッシュ化して上書きしてしまう。
            ...(password !== "" && { password }),
        });
    };

    const saveMutation = doctor === null ? createMutation : updateMutation;

    return {
        form,
        handleSubmit,
        submitError: saveMutation.error?.message ?? "",
        // 成功後も、一覧へ遷移し終えるまで保存中として扱い、もう一度送信されないようにする。
        isSaving: saveMutation.isPending || saveMutation.isSuccess,
    }
}

export default useDoctorEdit
