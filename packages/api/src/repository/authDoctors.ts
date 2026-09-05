import { prisma, Prisma } from "@repo/db";

// ログイン照合のためのクエリ。移植前は email と password の平文一致だったが、
// ハッシュ化に伴い「メールアドレスで引き、ハッシュは呼び出し側で照合する」形に
// 変えた（ADR 0005 決定 5）。
//
// password を select するのはこの関数だけである。他の取得系
// （repository/doctors.ts の doctorSelect）はパスワードを一切返さない。
const doctorCredentialsSelect = {
    id: true,
    password: true,
} satisfies Prisma.doctorsSelect;

export const findDoctorByEmail = (
    email: string
): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{
    select: typeof doctorCredentialsSelect;
}> | null> =>
    prisma.doctors.findFirst({
        select: doctorCredentialsSelect,
        where: { email },
    });
