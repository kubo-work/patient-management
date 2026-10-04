"use client";

import { TextInput, Flex, Button, PasswordInput, Alert } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import React, { FC } from "react";
import { useTRPC, type DoctorType } from "@/lib/trpc";
import useDoctorEdit from "./hooks/useDoctorEdit";

import styles from "../components/styles/EditFlexInput.module.scss";

type Props = {
  // null なら新規登録。更新のときは、取得済みの医師を渡す。
  doctor: DoctorType | null;
};

const DoctorForm: FC<Props> = React.memo(({ doctor }) => {
  const trpc = useTRPC();
  const { data: loginDoctor } = useQuery(trpc.doctor.loginDoctor.queryOptions());
  const { form, handleSubmit, submitError, isSaving } = useDoctorEdit(doctor);
  // パスワードを入力できるのは、新規登録と、ログイン中の医師が自分を編集するときだけ。
  const canEditPassword = doctor === null || doctor.id === loginDoctor?.id;

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
          {canEditPassword && (
            <Flex
              gap="lg"
              align={{ base: "stretch", sm: "center" }}
              direction={{ base: "column", sm: "row" }}
            >
              <label htmlFor="password" className={styles.label}>
                パスワード{!doctor && <span style={{ color: "red" }}>*</span>}
              </label>
              <PasswordInput
                id="password"
                placeholder={
                  doctor ? "変更する場合のみ入力してください。" : "パスワードを入力してください。"
                }
                required={!doctor}
                className={styles.input}
                {...form.getInputProps("password")}
              />
            </Flex>
          )}
          <Flex>
            <Button type="submit" loading={isSaving}>
              {doctor ? "更新" : "保存"}
            </Button>
          </Flex>
        </Flex>
      </form>
    </>
  );
});

DoctorForm.displayName = "DoctorForm";

export default DoctorForm;
