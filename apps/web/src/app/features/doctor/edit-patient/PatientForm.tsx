"use client";

import { sexList, type SexListData, type SexTypes } from "@repo/schema";
import { TextInput, Flex, Button, Alert, Select } from "@mantine/core";
import React, { FC } from "react";

import styles from "../components/styles/EditFlexInput.module.scss";
import usePatientEdit from "./hooks/usePatientEdit";
import { DateInput } from "@mantine/dates";
import dayjs from "dayjs";
import { toDateFromPickerValue } from "@/app/util/datePickerValue";
import type { PatientType } from "@/lib/trpc";

type Props = {
  // null なら新規登録。更新のときは、取得済みの患者を渡す。
  patient: PatientType | null;
};

// 性別の選択肢（Select の data）。@repo/schema の sexList を唯一の定義とし、ここでは形だけを変える。
// Object.keys はキーを string[] として返すため、sexList のキーであることを明示する。
const SEX_OPTIONS: SexListData[] = (Object.keys(sexList) as (keyof SexTypes)[]).map(
  (sex) => ({ value: sex, label: sexList[sex].label })
);

const PatientForm: FC<Props> = React.memo(({ patient }) => {
  const { form, handleSubmit, submitError, isSaving } = usePatientEdit(patient);
  return (
    <>
      {submitError && (
        <Alert color="red" mb="md">
          {submitError}
        </Alert>
      )}
      <form onSubmit={form.onSubmit(handleSubmit)}>
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
              required
              className={styles.input}
              {...form.getInputProps("name")}
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
              data={SEX_OPTIONS}
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
              required
              className={styles.input}
              {...form.getInputProps("tel")}
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
              required
              className={styles.input}
              {...form.getInputProps("address")}
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
              id="email"
              type="email"
              placeholder="**@example.com"
              className={styles.input}
              required
              {...form.getInputProps("email")}
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
              id="birth"
              placeholder="yyyy年M月d日"
              valueFormat="YYYY年M月D日"
              {...form.getInputProps("birth")}
              maxDate={dayjs().endOf("day").toDate()}
              onChange={(value) => {
                // 入力が空になったときは、直前の日付を保つ。
                if (!value) {
                  return;
                }
                form.setFieldValue("birth", toDateFromPickerValue(value));
              }}
            />
          </Flex>
          <Flex>
            <Button type="submit" loading={isSaving}>
              {patient ? "更新" : "保存"}
            </Button>
          </Flex>
        </Flex>
      </form>
    </>
  );
});

PatientForm.displayName = "PatientForm";

export default PatientForm;
