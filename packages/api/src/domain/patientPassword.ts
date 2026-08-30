import dayjs from "dayjs";

// 患者の初期パスワードは生年月日から導出する。移植前は patients.ts の
// ハンドラ内に 1 行で埋まっており、単体では検証できなかった。
//
// domain/ には Prisma / Hono / tRPC を import しない（ADR 0003 決定 2）。
// dayjs は日付整形のみのライブラリで I/O を持たないため例外ではない。
export const derivePatientInitialPassword = (birth: Date | string): string =>
    dayjs(birth).format("YYYYMMDD");
