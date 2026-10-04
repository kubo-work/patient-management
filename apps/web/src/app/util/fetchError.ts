// tRPC のエラーのうち、画面の表示の出し分けに使う部分だけを取り出した型。
export type FetchError = { data?: { code?: string } | null };

// 指定した ID のデータが無いときに、API が返すエラーコード（router の byId）。
const NOT_FOUND_ERROR_CODE = "NOT_FOUND";

export const isNotFoundError = (error: FetchError): boolean =>
    error.data?.code === NOT_FOUND_ERROR_CODE;
