import {
  Autocomplete,
  Button,
  Flex,
  MultiSelect,
  Select,
  Textarea,
} from "@mantine/core";
import React, { FC } from "react";
import { MedicalRecordsType } from "../../../../../../common/types/MedicalRecordsType";
import useMedicalRecordForm from "@/app/hooks/useMedicalRecordForm";

type Props = {
  name: string;
  data: MedicalRecordsType | null;
  mutate: () => void;
  modalClosed: () => void;
};

const MedicalRecordForm: FC<Props> = React.memo(
  ({ name, data, mutate, modalClosed }) => {
    const {
      getName,
      patientNameSuggestions,
      categories,
      doctorsData,
      form,
      handleSubmit,
    } = useMedicalRecordForm(name, data);
    return (
      <form
        onSubmit={form.onSubmit(() =>
          handleSubmit(form.values, mutate, modalClosed)
        )}
      >
        <Flex direction="column" gap="md">
          <Flex gap="md">
            <Autocomplete
              label="患者様"
              placeholder="患者名を入力してください"
              data={patientNameSuggestions.map((patient) => patient.value)}
              value={form.values.name}
              readOnly={getName ? true : false}
            />

            <Select
              label="担当者"
              data={doctorsData}
              {...form.getInputProps("doctor_id")}
            />
          </Flex>
          <Flex direction="column" gap="md">
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
            <Button type="submit">{getName ? "更新" : "作成"}</Button>
          </Flex>
        </Flex>
      </form>
    );
  }
);

MedicalRecordForm.displayName = "MedicalRecordForm";

export default MedicalRecordForm;
