import "@mantine/core/styles.css";
import "@mantine/dates/styles.css"; //if using mantine date picker features

import { AppShell, Burger, Button, Flex, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import style from "./layout.module.scss";
import useDoctorLogout from "./hooks/useDoctorLogout";
import React, { FC, ReactNode } from "react";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc";

type Props = {
  children: ReactNode;
};

const DoctorDashboardLayout: FC<Props> = React.memo((props) => {
  const { children } = props;
  const [opened, { toggle, close }] = useDisclosure();
  const { handleClickLogout } = useDoctorLogout();
  const trpc = useTRPC();
  const { data: loginDoctor } = useQuery(trpc.doctor.loginDoctor.queryOptions());
  return (
    <AppShell
      className={style.body}
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header className={style.header}>
        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        <Flex className={style.headerWrap}>
          <Title order={2}>診察管理</Title>
          <Text>{loginDoctor?.name} さん</Text>
        </Flex>
      </AppShell.Header>

      <AppShell.Navbar className={style.nav}>
        <Button
          component={Link}
          onClick={close}
          href="/doctor/patients-list"
          className={style.link}
        >
          患者一覧
        </Button>
        <Button
          component={Link}
          onClick={close}
          href="/doctor/doctors-list"
          className={style.link}
        >
          医者一覧
        </Button>
        <Button onClick={handleClickLogout}>ログアウト</Button>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
});

DoctorDashboardLayout.displayName = "DashboardLayout";

export default DoctorDashboardLayout;
