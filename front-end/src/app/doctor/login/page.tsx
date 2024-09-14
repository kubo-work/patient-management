import {
  Button,
  Container,
  Paper,
  PasswordInput,
  TextInput,
  Title,
} from "@mantine/core";
import { Metadata } from "next";
import React from "react";
import style from "./page.module.css";

export const metadata: Metadata = {
  title: "ログイン",
};

const page = () => {
  return (
    <main className={style.loginPage}>
      <Container p={10} size={420}>
        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <header className={style.header}>
            <Title order={1} ta="center">
              ログイン
            </Title>
          </header>
          <form>
            <TextInput required label="username" placeholder="" />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              mt="md"
            />
            <Button fullWidth mt="xl">
              Sign in
            </Button>
          </form>
        </Paper>
      </Container>
    </main>
  );
};

export default page;
