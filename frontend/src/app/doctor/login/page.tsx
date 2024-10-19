import { Container, Paper, Title } from "@mantine/core";
import { Metadata } from "next";
import React from "react";
import style from "./page.module.scss";
import LoginForm from "@/app/features/doctor/login/LoginForm";

export const metadata: Metadata = {
  title: "ログイン",
};

const page = () => {
  return (
    <main className={style.loginPage}>
      <Container p={10} size={420}>
        <Paper
          withBorder
          shadow="md"
          p={30}
          mt={30}
          radius="md"
          className={style.container}
        >
          <header className={style.header}>
            <Title order={1} ta="center">
              診察管理
            </Title>
          </header>
          <LoginForm styles={style} />
        </Paper>
      </Container>
    </main>
  );
};

export default page;
