"use client";

import useDoctorEdit from "@/app/hooks/useDoctorEdit";
import { revalidatePagedQueries } from "@/app/hooks/usePagedQuery";
import { DOCTORS_PAGE_QUERY_NAME } from "@/app/hooks/useDoctorsPage";
import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";
import { TextInput, Flex, Button, PasswordInput, Alert } from "@mantine/core";
import React, { FC } from "react";

import styles from "../components/styles/EditFlexInput.module.scss";

type Props = {
  id: number | null;
};

const EditDoctorContents: FC<Props> = React.memo(({ id }) => {
  const { loginDoctor, doctorsDoMutate } = useGlobalDoctor();
  const { form, handleSubmit, submitError } = useDoctorEdit(id);
  return (
    <>
      {submitError && (
        <Alert color="red" mb="md">
          {submitError}
        </Alert>
      )}
      <form
        onSubmit={form.onSubmit((values) =>
          handleSubmit(values, () => {
            doctorsDoMutate();
            revalidatePagedQueries(DOCTORS_PAGE_QUERY_NAME);
          })
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
          {(!id || id === loginDoctor?.id) && (
            <Flex
              gap="lg"
              align={{ base: "stretch", sm: "center" }}
              direction={{ base: "column", sm: "row" }}
            >
              <label htmlFor="password" className={styles.label}>
                パスワード{!id && <span style={{ color: "red" }}>*</span>}
              </label>
              <PasswordInput
                id="password"
                placeholder={
                  id ? "変更する場合のみ入力してください。" : "パスワードを入力してください。"
                }
                required={!id}
                className={styles.input}
                {...form.getInputProps("password")}
              />
            </Flex>
          )}
          <Flex>
            <Button type="submit">{id ? "更新" : "保存"}</Button>
          </Flex>
        </Flex>
      </form>
    </>
  );
});

EditDoctorContents.displayName = "EditDoctorContents";

export default EditDoctorContents;
