"use client";

import useDoctorEdit from "@/app/hooks/useDoctorEdit";
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
        onSubmit={form.onSubmit(() =>
          handleSubmit(form.values, doctorsDoMutate)
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
            <label htmlFor="name" className={styles.label}>
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
          {(!id || id === loginDoctor?.id) && (
            <Flex
              gap="lg"
              align={{ base: "stretch", sm: "center" }}
              direction={{ base: "column", sm: "row" }}
            >
              <label htmlFor="name" className={styles.label}>
                パスワード<span style={{ color: "red" }}>*</span>
              </label>
              <PasswordInput
                id="password"
                placeholder="パスワードを入力してください。"
                required
                className={styles.input}
                value={form.values.password}
                {...form.getInputProps("password")}
                error={form.errors.password}
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
