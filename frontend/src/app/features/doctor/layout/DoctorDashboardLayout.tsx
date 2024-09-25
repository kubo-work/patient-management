import { AppShell, Burger, Button, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import style from "./layout.module.scss";
import useDoctorLogout from "@/app/hooks/useDoctorLogout";
import React, { FC, ReactNode } from "react";

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
        <Button component="a" href={`/doctor/patients-list`}>
          患者一覧
        </Button>
        <Button onClick={handleClickLogout}>ログアウト</Button>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
});

DoctorDashboardLayout.displayName = "DashboardLayout";

export default DoctorDashboardLayout;
