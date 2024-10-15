import { Button, Flex, Select, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import React, { FC } from "react";
import { PatientType } from "../../../../../../common/types/PatientType";
import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";

type Props = {
  patientData: PatientType | null;
};

const ModalPatientForm: FC<Props> = React.memo(({ patientData }) => {
  const { sexList } = useGlobalDoctor();
  const sexListData = Object.entries(sexList).map(([key, value]) => ({
    value: key,
    label: value.label,
  }));
  const form = useForm({
    initialValues: {
      patient_id: patientData?.id,
      sex: patientData?.sex,
      name: patientData?.name,
      tel: patientData?.tel,
      address: patientData?.address,
      email: patientData?.email,
      birth: patientData?.birth,
    },
    validate: {
      name: (value) => (value ? null : "患者名を入力してください。"),
      tel: (value) => (value ? null : "電話番号を入力してください。"),
      address: (value) => (value ? null : "住所を入力してください。"),
      email: (value) => (value ? null : "メールアドレスを入力してください。"),
      birth: (value) => (value ? null : "誕生日を設定してください。"),
    },
  });
  return (
    <form>
      <Flex direction="column" gap="md">
        <TextInput
          label="患者様"
          placeholder="患者名を入力してください。"
          value={form.values.name}
          required
          {...form.getInputProps("name")}
          error={form.errors.name}
        />
        <Select
          label="性別"
          data={sexListData}
          placeholder="性別を選択してください。"
          {...form.getInputProps("sex")}
          required
          error={form.errors.sex}
        />
        <TextInput
          label="電話番号"
          placeholder="電話番号を入力してください。"
          value={form.values.tel}
          type="tel"
          {...form.getInputProps("tel")}
          error={form.errors.tel}
          required
        />
        <TextInput
          label="住所"
          placeholder="住所を入力してください。"
          value={form.values.address}
          {...form.getInputProps("address")}
          error={form.errors.address}
          required
        />
        <TextInput
          label="メールアドレス"
          placeholder="メールアドレスを入力してください。"
          value={form.values.email}
          type="email"
          {...form.getInputProps("email")}
          error={form.errors.email}
          required
        />
        <Button type="submit">更新</Button>
      </Flex>
    </form>
  );
});

ModalPatientForm.displayName = "ModalPatientForm";

export default ModalPatientForm;
