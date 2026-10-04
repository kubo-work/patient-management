import { Center, Loader } from "@mantine/core";
import type { FC } from "react";

// データの取得を待つ間に、内容の代わりに表示する。
// 表示済みの内容に重ねる場合は、Mantine の LoadingOverlay を使う（DataTable / LoginForm）。
const LoadingIndicator: FC = () => {
  return (
    <Center py="xl" role="status" aria-label="読み込み中">
      <Loader />
    </Center>
  );
};

export default LoadingIndicator;
