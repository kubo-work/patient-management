import {
  Alert,
  Autocomplete,
  Button,
  Flex,
  MultiSelect,
  Select,
  Textarea,
} from "@mantine/core";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import React, { FC } from "react";
import { MedicalRecordsType } from "../../../../../../common/types/MedicalRecordsType";
import useMedicalRecordForm from "@/app/hooks/useMedicalRecordForm";
import { DateTimePicker } from "@mantine/dates";
import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";

type Props = {
  name: string;
  data: MedicalRecordsType | null;
  mutate: () => void;
  modalClosed: () => void;
};

dayjs.extend(customParseFormat);

const MedicalRecordForm: FC<Props> = React.memo(
  ({ name, data, mutate, modalClosed }) => {
    const { patientNameSuggestions } = useGlobalDoctor();
    const {
      getName,
      categories,
      doctorsData,
      form,
      handleSubmit,
      handleDelete,
      submitError,
      inputDateTime,
      setInputDateTime,
    } = useMedicalRecordForm(name, data);
    return (
      <>
        {submitError && (
          <Alert color="red" mb="md">
            {submitError}
          </Alert>
        )}
        <form
          onSubmit={form.onSubmit(() =>
            handleSubmit(form.values, mutate, modalClosed)
          )}
        >
          <Flex direction="column" gap="lg">
            <Flex gap="md">
              <Autocomplete
                label="患者様"
                placeholder="患者名を入力してください。"
                data={patientNameSuggestions.map((patient) => patient.value)}
                value={form.values.name}
                readOnly={getName ? true : false}
                required
                {...form.getInputProps("name")}
                error={form.errors.name}
              />

              <Select
                label="担当者"
                data={doctorsData}
                placeholder="担当者を選択してください。"
                {...form.getInputProps("doctor_id")}
                required
                error={form.errors.doctor_id}
              />
            </Flex>
            <Flex direction="column" gap="md">
              <DateTimePicker
                required
                label="診察日"
                placeholder="yyyy年M月d日"
                valueFormat="YYYY年M月D日 HH:mm"
                {...form.getInputProps("examination_at")}
                error={form.errors.examination_at}
                value={inputDateTime}
                onChange={setInputDateTime}
              />
              {categories?.map((parentCategories) => {
                const childCategoriesData = parentCategories.children.map(
                  (childCategory) => ({
                    value: childCategory.id.toString(),
                    label: childCategory.treatment,
                  })
                );
                return (
                  <MultiSelect
                    key={parentCategories.id}
                    label={parentCategories.treatment}
                    placeholder="選択してください"
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
                );
              })}
              <Textarea
                label="メモ"
                value={form.values.medical_memo}
                onChange={(e) =>
                  form.setFieldValue("medical_memo", e.currentTarget.value)
                }
              />
              <Textarea
                label="お医者メモ"
                value={form.values.doctor_memo}
                onChange={(e) =>
                  form.setFieldValue("doctor_memo", e.currentTarget.value)
                }
              />
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
