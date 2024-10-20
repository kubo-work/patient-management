"use client";
import { MantineReactTable } from "mantine-react-table";
import React, { FC, useEffect } from "react";
import { useGlobalDoctor } from "@/app/hooks/useGlobalDoctor";
import useDoctorsList from "@/app/hooks/useDoctorsList";
import { Box, Button, Flex } from "@mantine/core";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Notifications, showNotification } from "@mantine/notifications";

const DoctorsListContents: FC<Record<string, never>> = React.memo(() => {
  const { columns } = useDoctorsList();
  const { doctors } = useGlobalDoctor();
  const searchParams = useSearchParams();
  const paramKey = "success";
  useEffect(() => {
    let message = "";
    const success = searchParams.get(paramKey);
    if (success) {
      if ("update" === success) {
        message = "更新しました。";
      } else if ("new" === success) {
        message = "保存しました。";
      }
      if (message) {
        showNotification({
          message,
          color: "orange",
          autoClose: 3000,
        });
      }

      // メッセージ表示後にクエリをクリアするためのリダイレクト
      // setTimeoutを使ってリダイレクト後にクエリをクリアする
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete(paramKey);
        window.history.replaceState({}, "", url);
      }, 3000);
    }
  }, [searchParams]);
  return (
    <>
      <Box pt={10} pb={40}>
        <Flex justify="center" gap={50}>
          <Link href={`/doctor/edit-doctor`} passHref legacyBehavior>
            <Button component="a">新しいお医者さんを登録</Button>
          </Link>
        </Flex>
      </Box>
      {doctors ? <MantineReactTable columns={columns} data={doctors} /> : ""}
      <Notifications />
    </>
  );
});

DoctorsListContents.displayName = "DoctorListContents";

export default DoctorsListContents;
