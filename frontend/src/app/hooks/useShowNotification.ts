import { showNotification } from "@mantine/notifications";
import { ReadonlyURLSearchParams } from "next/navigation";
import { useEffect } from "react";

const useShowNotification = (searchParams: ReadonlyURLSearchParams) => {
  const paramKey = "success";
  useEffect(() => {
    const setNotification = (message: string) => {
      showNotification({
        message,
        color: "orange",
        autoClose: 3000,
      });

      // メッセージ表示後にクエリをクリアするためのリダイレクト
      // setTimeoutを使ってリダイレクト後にクエリをクリアする
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete(paramKey);
        window.history.replaceState({}, "", url);
      }, 3000)
    }
    const success = searchParams.get(paramKey);
    if (success) {
      if ("update" === success) {
        setNotification("更新しました。");
      } else if ("new" === success) {
        setNotification("保存しました。");
      }
    }
  }, [searchParams]);
}

export default useShowNotification
