"use client";
import useDoctorLogin from "@/app/hooks/useDoctorLogin";
import {
  Alert,
  Box,
  Button,
  LoadingOverlay,
  PasswordInput,
  TextInput,
} from "@mantine/core";
import React, { FC } from "react";

type Props = {
  styles: { [key: string]: string };
};

const LoginForm: FC<Props> = React.memo((props) => {
  const { styles } = props;
  const { form, loginError, handleLogin, visible } = useDoctorLogin();

  return (
    <Box>
      <LoadingOverlay
        visible={visible}
        zIndex={1000}
        overlayProps={{ radius: "sm", blur: 1 }}
      />
      <form
        className={styles.form}
        onSubmit={form.onSubmit((values) => handleLogin(values))}
      >
        {loginError && (
          <Alert color="red" mb="md">
            {loginError}
          </Alert>
        )}
        <TextInput
          required
          type="email"
          label="メールアドレス"
          placeholder="**@example.com"
          {...form.getInputProps("email")}
        />
        <PasswordInput
          label="パスワード"
          placeholder="パスワードを入力してください。"
          required
          mt="md"
          {...form.getInputProps("password")}
        />
        <Button fullWidth mt="xl" type="submit">
          ログイン
        </Button>
      </form>
    </Box>
  );
});

LoginForm.displayName = "LoginForm";

export default LoginForm;
