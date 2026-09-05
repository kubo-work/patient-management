import { prisma, Prisma } from "@repo/db";

// select を satisfies で型付けした上で戻り値型を明示しているのは、
// tsconfig の declaration: true 下で推論に任せると TS2883
// （PrismaPromise を含む推論結果を .d.ts に書き出せない）で
// ビルドが失敗するため。Prisma 7 の生成クライアント構造に起因する制約で、
// クエリの内容自体は移植前の doctor/doctors.ts と変えていない。
// password はここに含めない。ログイン照合に必要なハッシュは
// repository/authDoctors.ts の findDoctorByEmail だけが select する
// （ADR 0005 決定 6）。
const doctorSelect = {
    id: true,
    name: true,
    email: true,
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

// 医師データを更新する。移植前は select 未指定で全カラム（password と
// created_at / updated_at を含む）を返していたが、select を指定して返す範囲を
// doctorSelect に揃えた（ADR 0005 決定 6）。
//
// password が undefined の場合、Prisma はそのカラムを更新しない。これが
// 「パスワードを変更しない更新」の実現手段である（ADR 0005 決定 4）。
export const updateDoctor = (
    doctorId: number,
    data: { name: string; email: string; password?: string; updated_at: Date }
): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{ select: typeof doctorSelect }>> =>
    prisma.doctors.update({
        where: { id: doctorId },
        data,
        select: doctorSelect,
    });

// 医師データを新規作成する。update と同じ理由で select を指定し、
// 返す範囲を doctorSelect に揃えている（ADR 0005 決定 6）。
export const createDoctor = (data: {
    name: string;
    email: string;
    password: string;
}): Prisma.PrismaPromise<Prisma.doctorsGetPayload<{ select: typeof doctorSelect }>> =>
    prisma.doctors.create({ data, select: doctorSelect });
