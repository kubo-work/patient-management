import { useForm } from "@mantine/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import setShowNotification from "../../../../../../constants/setShowNotification";
import { useTRPC, type PatientType } from "../../../../../lib/trpc";

type FormValues = {
    name: string;
    email: string;
    sex: string;
    tel: string;
    address: string;
    birth: Date;
}

// 一覧画面は、この値に応じた通知を出す（useShowNotification）。
type SaveResult = "new" | "update";

const DEFAULT_SEX = "no_answer";

const toInitialValues = (patient: PatientType | null): FormValues => {
    if (patient === null) {
        return { name: "", email: "", tel: "", sex: DEFAULT_SEX, address: "", birth: new Date() };
    }
    return {
        name: patient.name,
        email: patient.email,
        sex: patient.sex,
        tel: patient.tel,
        address: patient.address,
        birth: patient.birth,
    };
};

// patient が null なら新規登録、取得済みの患者なら更新のフォームになる。
const usePatientEdit = (patient: PatientType | null) => {
    const router = useRouter();
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const form = useForm<FormValues>({
        initialValues: toInitialValues(patient),

        validate: {
            name: (value) => value === "" && "お名前を入力してください。",
            email: (value) =>
                /^\S+@\S+$/.test(value) ? null : "メールアドレスを入力してください。",
            tel: (value) => value === "" && "電話番号を入力してください。",
            address: (value) => value === "" && "住所を入力してください。",
            // 生年月日は空にできない（初期値が必ず入り、入力欄は空への変更を受け付けない）ため、未来の日付だけを確かめる。
            birth: (value) => {
                const now = dayjs().startOf('minute');
                const selectedTime = dayjs(value).startOf('minute');
                return selectedTime.isAfter(now) ? "未来の日付は選択できません。" : null;
            }
        },
    });

    // 患者の一覧と 1 件取得の結果を古い扱いにしてから、一覧へ戻る。一覧は表示時に取り直す。
    // refetchType: "none" で、表示中のこの編集画面の取得は取り直させない（EditPatientContents）。
    const returnToList = (saveResult: SaveResult): void => {
        void queryClient.invalidateQueries({
            ...trpc.doctor.patients.pathFilter(),
            refetchType: "none",
        });
        router.push(`/doctor/patients-list?success=${saveResult}`);
    };

    // tRPC はエラーを throw する。message には移植前と同じ日本語が入る。
    const notifyError = (error: { message: string }): void => {
        setShowNotification(error.message, "red");
    };

    const createMutation = useMutation(
        trpc.doctor.patients.create.mutationOptions({
            onSuccess: () => returnToList("new"),
            onError: notifyError,
        })
    );
    const updateMutation = useMutation(
        trpc.doctor.patients.update.mutationOptions({
            onSuccess: () => returnToList("update"),
            onError: notifyError,
        })
    );

    const handleSubmit = (values: FormValues): void => {
        if (patient === null) {
            createMutation.mutate(values);
            return;
        }
        updateMutation.mutate({ id: patient.id, ...values });
    };

    const saveMutation = patient === null ? createMutation : updateMutation;

    return {
        form,
        handleSubmit,
        submitError: saveMutation.error?.message ?? "",
        // 成功後も、一覧へ遷移し終えるまで保存中として扱い、もう一度送信されないようにする。
        isSaving: saveMutation.isPending || saveMutation.isSuccess,
    }
}

export default usePatientEdit
