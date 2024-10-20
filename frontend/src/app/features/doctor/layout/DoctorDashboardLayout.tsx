import "@mantine/core/styles.css";
import "@mantine/dates/styles.css"; //if using mantine date picker features
import "mantine-react-table/styles.css"; //make sure MRT styles were imported in your app root (once)

import { AppShell, Burger, Button, Flex, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import style from "./layout.module.scss";
import useDoctorLogout from "@/app/hooks/useDoctorLogout";
import React, { FC, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";

type Props = {
  children: ReactNode;
};

const DoctorDashboardLayout: FC<Props> = React.memo((props) => {
  const { children } = props;
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure();
  const { handleClickLogout } = useDoctorLogout();
  const { loginDoctor } = useGlobalDoctor();
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
        <Link href={`/doctor/patients-list`} passHref legacyBehavior>
          <Button
            component="a"
            className={
              pathname === `/doctor/patients-list` ||
              pathname.indexOf("medical-records") !== -1
                ? style.current
                : ""
            }
            onClick={close}
          >
            患者一覧
          </Button>
        </Link>
        <Link href={`/doctor/doctors-list`} passHref legacyBehavior>
          <Button
            component="a"
            className={
              pathname === `/doctor/doctors-list` ||
              pathname.indexOf("edit-doctor") !== -1
                ? style.current
                : ""
            }
            onClick={close}
          >
            医者一覧
          </Button>
        </Link>

        <Button onClick={handleClickLogout}>ログアウト</Button>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
});

DoctorDashboardLayout.displayName = "DashboardLayout";

export default DoctorDashboardLayout;
