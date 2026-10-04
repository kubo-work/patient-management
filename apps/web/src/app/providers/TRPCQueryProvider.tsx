"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useState, type ReactNode } from "react";
import { createAppTRPCClient, TRPCProvider } from "../../lib/trpc";

const MAX_QUERY_RETRY_COUNT = 3;
const SERVER_ERROR_MIN_HTTP_STATUS = 500;

// 入力の誤りや未認証（HTTP 4xx）は、取り直しても結果が変わらないため再試行しない。
// 通信の失敗やサーバ側の障害（HTTP 5xx）だけを再試行の対象にする。
const isRetryableError = (error: unknown): boolean => {
    if (!(error instanceof TRPCClientError)) {
        return true;
    }
    const httpStatus: unknown = error.data?.httpStatus;
    return typeof httpStatus !== "number" || httpStatus >= SERVER_ERROR_MIN_HTTP_STATUS;
};

// staleTime（既定 0）と refetchOnWindowFocus（既定 true）は変えない。
// 画面を開き直したときとタブへ戻ったときに取り直す。
const createQueryClient = (): QueryClient =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: (failureCount, error) =>
                    failureCount < MAX_QUERY_RETRY_COUNT && isRetryableError(error),
            },
        },
    });

let browserQueryClient: QueryClient | undefined;

// サーバでは描画ごとに作り、リクエスト間でキャッシュを共有しない。
// ブラウザでは 1 つを使い回し、再描画でキャッシュを失わないようにする。
const getQueryClient = (): QueryClient => {
    if (typeof window === "undefined") {
        return createQueryClient();
    }
    browserQueryClient ??= createQueryClient();
    return browserQueryClient;
};

type Props = {
    children: ReactNode;
};

const TRPCQueryProvider = ({ children }: Props) => {
    const queryClient = getQueryClient();
    const [trpcClient] = useState(createAppTRPCClient);

    return (
        <QueryClientProvider client={queryClient}>
            <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
                {children}
            </TRPCProvider>
        </QueryClientProvider>
    );
};

export default TRPCQueryProvider;
