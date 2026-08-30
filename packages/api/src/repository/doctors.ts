import { prisma, Prisma } from "@repo/db";

// select を satisfies で型付けした上で戻り値型を明示しているのは、
// tsconfig の declaration: true 下で推論に任せると TS2883
// （PrismaPromise を含む推論結果を .d.ts に書き出せない）で
// ビルドが失敗するため。Prisma 7 の生成クライアント構造に起因する制約で、
// クエリの内容自体は移植前の doctor/doctors.ts と変えていない。
const doctorSelect = {
    id: true,
    name: true,
    email: true,
    password: true,
} satisfies Prisma.doctorsSelect;

// 医師一覧を取得する。移植前の doctor/doctors.ts の GET / のクエリをそのまま移した。
export const findAllDoctors = (): Prisma.PrismaPromise<
    Array<Prisma.doctorsGetPayload<{ select: typeof doctorSelect }>>
> =>
    prisma.doctors.findMany({
        select: doctorSelect,
        orderBy: { id: "asc" },
    });

// id 指定で医師を 1 件取得する。移植前の doctor/doctors.ts の
// GET /:doctor_id と doctor/login_doctor.ts の GET / の両方がこの形の
// クエリ（select は同一）を使っていたため、共通の関数として 1 つにまとめている。
export const findDoctorById = (
    doctorId: number
): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{ select: typeof doctorSelect }> | null> =>
    prisma.doctors.findFirst({
        select: doctorSelect,
        where: { id: doctorId },
    });

// 医師データを更新する。移植前の doctor/doctors.ts の PUT /:doctor_id の
// クエリをそのまま移した。select を指定していないため戻り値は
// Prisma.doctorsGetPayload<{}>（全カラム）になる。
export const updateDoctor = (
    doctorId: number,
    data: { name: string; email: string; password: string; updated_at: Date }
): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{}>> =>
    prisma.doctors.update({
        where: { id: doctorId },
        data,
    });

// 医師データを新規作成する。移植前の doctor/doctors.ts の POST / の
// クエリをそのまま移した。select を指定していないため戻り値は
// Prisma.doctorsGetPayload<{}>（全カラム）になる。
export const createDoctor = (data: {
    name: string;
    email: string;
    password: string;
}): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{}>> => prisma.doctors.create({ data });
