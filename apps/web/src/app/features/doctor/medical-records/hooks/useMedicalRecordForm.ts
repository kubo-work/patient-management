"use client";
import { useForm } from "@mantine/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import setShowNotification from "../../../../../../constants/setShowNotification";
import { useTRPC, type MedicalRecordType } from "../../../../../lib/trpc";

type FormValues = {
    // 未選択は null。Mantine 9 から Select が数値の値を扱えるため、ID を文字列へ変換しない。
    doctor_id: number | null;
    categories: string[];
    examination_at: Date;
    medical_memo: string;
    doctor_memo: string;
}

type MedicalRecordFormOptions = {
    // 診察履歴画面の URL（patients_id）で確定している患者。
    // 以前は患者名で全患者から探していたため、同じ名前の患者がいると別の患者の診察として保存された。
    patientId: number;
    // null なら新規作成。更新のときは、一覧で選んだ診察を渡す。
    medicalRecord: MedicalRecordType | null;
    // 新規作成で、担当者として最初に選んでおく医師（ログイン中の医師）。
    defaultDoctorId: number | null;
    // 保存・削除が済んだ後に呼ぶ（モーダルを閉じる）。
    onSaved: () => void;
}

const DOCTOR_NOT_SELECTED_MESSAGE = "選択してください。";

const toInitialValues = (
    medicalRecord: MedicalRecordType | null,
    defaultDoctorId: number | null
): FormValues => {
    if (medicalRecord === null) {
        return {
            doctor_id: defaultDoctorId,
            categories: [],
            examination_at: new Date(),
            medical_memo: "",
            doctor_memo: "",
        };
    }
    return {
        doctor_id: medicalRecord.doctor_id,
        categories: medicalRecord.categories.map((category) => category.id.toString()),
        examination_at: medicalRecord.examination_at,
        medical_memo: medicalRecord.medical_memo,
        doctor_memo: medicalRecord.doctor_memo,
    };
};

const useMedicalRecordForm = ({
    patientId,
    medicalRecord,
    defaultDoctorId,
    onSaved,
}: MedicalRecordFormOptions) => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { data: categories } = useQuery(trpc.doctor.categories.list.queryOptions());
    // 担当者の選択肢には医師の全件を使う。医師一覧画面はページごとに取得する（useDoctorsPage）。
    const { data: doctors } = useQuery(trpc.doctor.doctors.list.queryOptions());

    const form = useForm<FormValues>({
        initialValues: toInitialValues(medicalRecord, defaultDoctorId),
        validate: {
            doctor_id: (value) => value === null ? DOCTOR_NOT_SELECTED_MESSAGE : null,
            categories: (value) => value.length > 0 ? null : "少なくとも1つのカテゴリを選択してください",
            // 診察日は空にできない（初期値が必ず入り、入力欄は空への変更を受け付けない）ため、未来の日時だけを確かめる。
            examination_at: (value) => {
                const now = dayjs().startOf('minute');
                const selectedTime = dayjs(value).startOf('minute');
                return selectedTime.isAfter(now) ? "未来の日時は選択できません。" : null;
            }
        },
    })

    const doctorOptions = doctors?.map((doctor) => ({
        value: doctor.id,
        label: doctor.name,
    }));

    // 今表示しているページだけでなく、診察の一覧の全ページを取り直してからモーダルを閉じる。
    // 今のページだけだと、別のページへ切り替えたときに古い内容が一瞬表示される。
    const finishSaving = async (message: string): Promise<void> => {
        await queryClient.invalidateQueries(trpc.doctor.medicalRecords.pathFilter());
        onSaved();
        setShowNotification(message, "orange");
    };

    // tRPC はエラーを throw する。message には移植前と同じ日本語が入る。
    const notifyError = (error: { message: string }): void => {
        setShowNotification(error.message, "red");
    };

    const createMutation = useMutation(
        trpc.doctor.medicalRecords.create.mutationOptions({
            onSuccess: () => finishSaving("診察を保存しました。"),
            onError: notifyError,
        })
    );
    const updateMutation = useMutation(
        trpc.doctor.medicalRecords.update.mutationOptions({
            onSuccess: () => finishSaving("診察を更新しました。"),
            onError: notifyError,
        })
    );
    const removeMutation = useMutation(
        trpc.doctor.medicalRecords.remove.mutationOptions({
            onSuccess: () => finishSaving("診察を削除しました。"),
            onError: notifyError,
        })
    );
    const saveMutation = medicalRecord === null ? createMutation : updateMutation;

    const handleSubmit = ({ doctor_id, ...otherValues }: FormValues): void => {
        // 検証（validate）を通っていれば null にはならない。型の上で null を除くために確かめる。
        // 到達した場合も、検証のときと同じく担当者の欄にエラーを出す。
        if (doctor_id === null) {
            form.setFieldError("doctor_id", DOCTOR_NOT_SELECTED_MESSAGE);
            return;
        }
        // 前の削除の失敗が残っていても、保存の結果だけを表示する。
        removeMutation.reset();
        const medicalRecordInput = { patient_id: patientId, doctor_id, ...otherValues };
        if (medicalRecord === null) {
            createMutation.mutate(medicalRecordInput);
            return;
        }
        updateMutation.mutate({ id: medicalRecord.id, ...medicalRecordInput });
    };

    const handleDelete = (): void => {
        if (medicalRecord === null) {
            return;
        }
        if (!window.confirm("削除しますか？")) {
            return;
        }
        // 前の保存の失敗が残っていても、削除の結果だけを表示する。
        saveMutation.reset();
        removeMutation.mutate({ id: medicalRecord.id });
    };

    const submitError = (saveMutation.error ?? removeMutation.error)?.message ?? "";

    return {
        categories,
        doctorOptions,
        form,
        handleSubmit,
        handleDelete,
        submitError,
        // どちらも、一覧の取り直しが済んでモーダルが閉じるまで true のままになる。
        isSaving: saveMutation.isPending,
        isDeleting: removeMutation.isPending,
    }
}

export default useMedicalRecordForm
