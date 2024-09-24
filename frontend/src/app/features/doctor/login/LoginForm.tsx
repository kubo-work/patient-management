"use client";
import { useDoctorLogin } from "@/app/hooks/useDoctorLogin";
import { Alert, Button, PasswordInput, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import React, { FC } from "react";

type Props = {
  styles: { [key: string]: string };
};

const LoginForm: FC<Props> = React.memo((props) => {
  const { styles } = props;
  const { loginError, handleLogin } = useDoctorLogin();
  const form = useForm({
    initialValues: {
      email: "",
      password: "",
    },

    validate: {
      email: (val) =>
        /^\S+@\S+$/.test(val) ? null : "メールアドレスを入力してください。",
      password: (val) => val === "" && "パスワードを入力してください。",
    },
  });
  return (
    <form
      className={styles.form}
      onSubmit={form.onSubmit(() => handleLogin(form.values))}
    >
      {loginError && (
        <Alert color="red" mb="md">
          {loginError}
        </Alert>
      )}
      <TextInput
        required
        type="email"
        label="id"
        placeholder="**@example.com"
        onChange={(e) => form.setFieldValue("email", e.currentTarget.value)}
        value={form.values.email}
      />
      <PasswordInput
        label="Password"
        placeholder="Your password"
        required
        mt="md"
        onChange={(e) => form.setFieldValue("password", e.currentTarget.value)}
        value={form.values.password}
      />
      <Button fullWidth mt="xl" type="submit">
        Sign in
      </Button>
    </form>
  );
});

LoginForm.displayName = "LoginForm";

export default LoginForm;
