import "@mantine/core/styles.css";
import "@mantine/dates/styles.css"; //if using mantine date picker features
import "mantine-react-table/styles.css"; //make sure MRT styles were imported in your app root (once)

import { AppShell, Burger, Button, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import style from "./layout.module.scss";
import useDoctorLogout from "@/app/hooks/useDoctorLogout";
import React, { FC, ReactNode } from "react";
import Link from "next/link";

type Props = {
  children: ReactNode;
};

const DoctorDashboardLayout: FC<Props> = React.memo((props) => {
  const { children } = props;
  const [opened, { toggle }] = useDisclosure();
  const { handleClickLogout } = useDoctorLogout();
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
        <Title order={2}>医心堂鍼灸整骨院</Title>
      </AppShell.Header>

      <AppShell.Navbar className={style.nav}>
        <Link href={`/doctor/patients-list`} passHref legacyBehavior>
          <Button component="a">患者一覧</Button>
        </Link>

        <Button onClick={handleClickLogout}>ログアウト</Button>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
});

DoctorDashboardLayout.displayName = "DashboardLayout";

export default DoctorDashboardLayout;
