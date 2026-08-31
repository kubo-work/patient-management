import { prisma, Prisma } from "@repo/db";

// ログインの照合。移植前は email と password の平文一致だった。
// パスワードの平文保存そのものは本 Issue の範囲外（ADR 0002 の残課題）。
//
// select を指定していないため戻り値は Prisma.doctorsGetPayload<{}>（全カラム）。
// tsconfig の declaration: true 下で推論に任せると TS2883 でビルドが失敗するため、
// repository/patients.ts 等と同様に戻り値型を明示する。
export const findDoctorByCredentials = (
    email: string,
    password: string
): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{}> | null> =>
    prisma.doctors.findFirst({ where: { AND: [{ email }, { password }] } });
