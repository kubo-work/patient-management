import {
  Alert,
  Button,
  Flex,
  MultiSelect,
  Select,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type { FC } from "react";
import { useTRPC, type MedicalRecordType } from "@/lib/trpc";
import useMedicalRecordForm from "./hooks/useMedicalRecordForm";
import { DateTimePicker } from "@mantine/dates";
import { toDateFromPickerValue } from "@/app/util/datePickerValue";

import LoadingIndicator from "../components/LoadingIndicator";
import styles from "./styles/MedicalRecordForm.module.scss";

type Props = {
  name: string;
  patientId: number;
  // null なら新規作成。
  data: MedicalRecordType | null;
  modalClosed: () => void;
};

type MedicalRecordFormFieldsProps = Props & {
  // 新規作成で、担当者として最初に選んでおく医師。
  defaultDoctorId: number | null;
};

dayjs.extend(customParseFormat);

const MedicalRecordFormFields: FC<MedicalRecordFormFieldsProps> = ({
  name,
  patientId,
  data,
  modalClosed,
  defaultDoctorId,
}) => {
  const {
    categories,
    doctorOptions,
    form,
    handleSubmit,
    handleDelete,
    submitError,
    isSaving,
    isDeleting,
  } = useMedicalRecordForm({
    patientId,
    medicalRecord: data,
    defaultDoctorId,
    onSaved: modalClosed,
  });
  return (
    <>
      {submitError && (
        <Alert color="red" mb="md">
          {submitError}
        </Alert>
      )}
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Flex direction="column" gap="lg">
          <Flex gap={{ base: "sm", sm: "lg" }}>
            {/* 診察履歴画面の患者に固定されるため、表示のみで変更させない。 */}
            <TextInput
              style={{ flex: 1 }}
              label="患者様"
              value={name}
              readOnly
            />

            <Select
              label="担当者"
              style={{ flex: 1 }}
              data={doctorOptions}
              placeholder="担当者を選択してください。"
              {...form.getInputProps("doctor_id")}
              required
            />
          </Flex>
          <Flex direction="column" gap="md">
            <DateTimePicker
              required
              label="診察日"
              placeholder="yyyy年M月d日"
              valueFormat="YYYY年M月D日 HH:mm"
              {...form.getInputProps("examination_at")}
              onChange={(value) => {
                // 入力が空になったときは、直前の日時を保つ。
                if (!value) {
                  return;
                }
                form.setFieldValue("examination_at", toDateFromPickerValue(value));
              }}
              maxDate={dayjs().endOf("day").toDate()}
            />
            <Flex direction="column" gap="md">
              <Text>
                カテゴリ<span style={{ color: "red" }}>*</span>
              </Text>
              <Flex
                direction="column"
                gap="md"
                className={styles.categoryWrap}
              >
                {categories?.map((parentCategories, i) => {
                  const childCategoriesData = parentCategories.children.map(
                    (childCategory) => ({
                      value: childCategory.id.toString(),
                      label: childCategory.treatment,
                    })
                  );
                  return (
                    <div
                      className={styles.flexWrap}
                      key={parentCategories.id}
                    >
                      <label
                        htmlFor={`category${i}`}
                        className={styles.selectLabel}
                      >
                        {parentCategories.treatment}
                      </label>
                      <MultiSelect
                        id={`category${i}`}
                        placeholder="選択してください"
                        className={styles.selectCategory}
                        data={childCategoriesData}
                        value={form.values.categories.filter((category) =>
                          childCategoriesData.some(
                            (child) => child.value === category
                          )
                        )}
                        onChange={(value) => {
                          // 選択された値をそのままセット
                          form.setFieldValue("categories", [
                            ...form.values.categories.filter(
                              (cat) =>
                                !childCategoriesData.some(
                                  (child) => child.value === cat
                                )
                            ),
                            ...value,
                          ]);
                        }}
                        error={form.errors.categories}
                      />
                    </div>
                  );
                })}
              </Flex>
            </Flex>

            <Textarea label="メモ" {...form.getInputProps("medical_memo")} />
            <Textarea label="お医者メモ" {...form.getInputProps("doctor_memo")} />
            {/* 保存中は削除を、削除中は保存を押せなくし、同じ診察へ 2 つの操作を同時に送らない。 */}
            <Button type="submit" loading={isSaving} disabled={isDeleting}>
              {data === null ? "保存" : "更新"}
            </Button>
            {data && (
              <Button
                style={{ background: "red" }}
                onClick={handleDelete}
                loading={isDeleting}
                disabled={isSaving}
              >
                削除
              </Button>
            )}
          </Flex>
        </Flex>
      </form>
    </>
  );
};

// 新規作成の担当者の初期値にログイン中の医師を使うため、その取得が済んでからフォームを描画する。
const MedicalRecordForm: FC<Props> = (props) => {
  const trpc = useTRPC();
  const { data: loginDoctor, isPending } = useQuery(
    trpc.doctor.loginDoctor.queryOptions()
  );

  if (isPending) return <LoadingIndicator />;

  return (
    <MedicalRecordFormFields {...props} defaultDoctorId={loginDoctor?.id ?? null} />
  );
};

export default MedicalRecordForm;
