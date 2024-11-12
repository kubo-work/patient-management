"use client";

import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";
import { TextInput, Flex, Button, Alert, Select } from "@mantine/core";
import React, { FC } from "react";

import styles from "../components/styles/EditFlexInput.module.scss";
import usePatientEdit from "@/app/hooks/usePatientEdit";
import { DateInput } from "@mantine/dates";

type Props = {
  id: number | null;
};

const EditPatientContents: FC<Props> = React.memo(({ id }) => {
  const { patientsMutate, sexListData } = useGlobalDoctor();
  const { form, handleSubmit, submitError } = usePatientEdit(id);
  return (
    <>
      {submitError && (
        <Alert color="red" mb="md">
          {submitError}
        </Alert>
      )}
      <form
        onSubmit={form.onSubmit(() =>
          handleSubmit(form.values, patientsMutate)
        )}
      >
        <Flex direction="column" gap="lg">
          <Flex
            gap="lg"
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
          >
            <label htmlFor="name" className={styles.label}>
              名前<span style={{ color: "red" }}>*</span>
            </label>
            <TextInput
              id="name"
              placeholder="山田太郎"
              value={form.values.name}
              required
              className={styles.input}
              {...form.getInputProps("name")}
              error={form.errors.name}
            />
          </Flex>
          <Flex
            gap="lg"
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
          >
            <label htmlFor="sex" className={styles.label}>
              性別
            </label>
            <Select
              id="sex"
              data={sexListData}
              {...form.getInputProps("sex")}
              required
            />
          </Flex>
          <Flex
            gap="lg"
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
          >
            <label htmlFor="tel" className={styles.label}>
              電話番号<span style={{ color: "red" }}>*</span>
            </label>
            <TextInput
              id="tel"
              placeholder="0000-11-2222"
              value={form.values.tel}
              required
              className={styles.input}
              {...form.getInputProps("tel")}
              error={form.errors.tel}
            />
          </Flex>
          <Flex
            gap="lg"
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
          >
            <label htmlFor="address" className={styles.label}>
              住所<span style={{ color: "red" }}>*</span>
            </label>
            <TextInput
              id="address"
              placeholder="⚪︎⚪︎県⚪︎⚪︎市⚪︎⚪︎番地"
              value={form.values.address}
              required
              className={styles.input}
              {...form.getInputProps("address")}
              error={form.errors.address}
            />
          </Flex>
          <Flex
            gap="lg"
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
          >
            <label htmlFor="email" className={styles.label}>
              メールアドレス<span style={{ color: "red" }}>*</span>
            </label>
            <TextInput
              id="mail"
              type="email"
              placeholder="**@example.com"
              value={form.values.email}
              className={styles.input}
              required
              {...form.getInputProps("email")}
              error={form.errors.email}
            />
          </Flex>
          <Flex
            gap="lg"
            align={{ base: "stretch", sm: "center" }}
            direction={{ base: "column", sm: "row" }}
          >
            <label htmlFor="birth" className={styles.label}>
              生年月日<span style={{ color: "red" }}>*</span>
            </label>
            <DateInput
              placeholder="yyyy年M月d日"
              valueFormat="YYYY年M月D日"
              {...form.getInputProps("birth")}
              error={form.errors.birth}
              value={form.values.birth}
              onChange={(value) => {
                if (!value) {
                  return "生年月日を選択してください。";
                }
                form.setFieldValue("birth", value);
              }}
            />
          </Flex>
          <Flex>
            <Button type="submit">{id ? "更新" : "保存"}</Button>
          </Flex>
        </Flex>
      </form>
    </>
  );
});

EditPatientContents.displayName = "EditPatientContents";

export default EditPatientContents;
