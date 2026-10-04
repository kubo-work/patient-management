import { Alert } from "@mantine/core";
import type { FC } from "react";
import { isNotFoundError, type FetchError } from "@/app/util/fetchError";

type Props = {
  error: FetchError;
};

// 取得に失敗したときに、内容の代わりに表示する。
// データが無い場合と、それ以外（通信の失敗・サーバ側の障害・認証切れ）を分けて伝える。
const FetchErrorAlert: FC<Props> = ({ error }) => {
  const message = isNotFoundError(error)
    ? "データが見つかりません"
    : "データの取得に失敗しました。";

  return (
    <Alert color="red" mb="md">
      {message}
    </Alert>
  );
};

export default FetchErrorAlert;
