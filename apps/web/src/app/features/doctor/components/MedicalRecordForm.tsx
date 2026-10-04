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
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import React, { FC } from "react";
import type { MedicalRecordType } from "@/lib/trpc";
import useMedicalRecordForm from "@/app/hooks/useMedicalRecordForm";
import { DateTimePicker } from "@mantine/dates";
import { toDateFromPickerValue } from "@/app/util/datePickerValue";

import styles from "./styles/MedicalRecordForm.module.scss";

type Props = {
  name: string;
  patientId: number;
  data: MedicalRecordType | null;
  mutate: () => void;
  modalClosed: () => void;
};

dayjs.extend(customParseFormat);

const MedicalRecordForm: FC<Props> = React.memo(
  ({ name, patientId, data, mutate, modalClosed }) => {
    const {
      categories,
      doctorsData,
      form,
      handleSubmit,
      handleDelete,
      submitError,
    } = useMedicalRecordForm(patientId, data);
    return (
      <>
        {submitError && (
          <Alert color="red" mb="md">
            {submitError}
          </Alert>
        )}
        <form
          onSubmit={form.onSubmit((values) =>
            handleSubmit(values, mutate, modalClosed)
          )}
        >
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
                data={doctorsData}
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
              <Button type="submit">{data === null ? "保存" : "更新"}</Button>
              {data && (
                <Button
                  style={{ background: "red" }}
                  onClick={() => handleDelete(data.id, mutate, modalClosed)}
                >
                  削除
                </Button>
              )}
            </Flex>
          </Flex>
        </form>
      </>
    );
  }
);

MedicalRecordForm.displayName = "MedicalRecordForm";

export default MedicalRecordForm;
