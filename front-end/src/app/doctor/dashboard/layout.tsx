"use client";
import { AppShell, Burger, Button, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import style from "./layout.module.scss";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
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

      <AppShell.Navbar>
        <Button className={style.sideButton}>ログアウト</Button>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
