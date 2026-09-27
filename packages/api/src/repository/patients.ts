import { prisma, Prisma, Sex } from "@repo/db";
import type { PageRequest, PatientSortColumn } from "@repo/schema";
import { toPrismaPaging, type PageResult } from "./pagination.js";

// select を satisfies で型付けした上で戻り値型を明示しているのは、
// tsconfig の declaration: true 下で推論に任せると TS2883
// （PrismaPromise を含む推論結果を .d.ts に書き出せない）で
// ビルドが失敗するため。updatePatient / createPatient は
// 移植前の doctor/patients.ts が select を指定していなかったため
// クエリ自体は変えず、戻り値型のみ Prisma.patientsGetPayload<{}> で明示する。
const patientByIdSelect = {
    id: true,
    name: true,
    email: true,
    tel: true,
    sex: true,
    address: true,
    birth: true,
} satisfies Prisma.patientsSelect;

// 一覧に表示する列だけを取る。連絡先・生年月日は一覧に出さないため、クライアントへ送らない。
const patientListItemSelect = {
    id: true,
    name: true,
    sex: true,
    address: true,
} satisfies Prisma.patientsSelect;

// 患者一覧の 1 ページ分と全件数を取得する。2 つのクエリを同じトランザクションで実行し、
// 間に登録があっても行と件数が食い違わないようにする。
export const findPatientsPage = async (
    request: PageRequest<PatientSortColumn>
): Promise<PageResult<Prisma.patientsGetPayload<{ select: typeof patientListItemSelect }>>> => {
    const [items, totalCount] = await prisma.$transaction([
        prisma.patients.findMany({ select: patientListItemSelect, ...toPrismaPaging(request) }),
        prisma.patients.count(),
    ]);
    return { items, totalCount };
};

// id 指定で患者を 1 件取得する。移植前の doctor/patients.ts の
// GET /:patient_id の select・where・orderBy をそのまま移した。
export const findPatientById = (
    patientId: number
): Prisma.PrismaPromise<Prisma.patientsGetPayload<{ select: typeof patientByIdSelect }> | null> =>
    prisma.patients.findFirst({
        select: patientByIdSelect,
        where: { id: patientId },
        orderBy: { id: "asc" },
    });

// 患者データを更新する。移植前の doctor/patients.ts の PUT /:patient_id の
// クエリをそのまま移した。select を指定していないため戻り値は全カラム。
export const updatePatient = (
    patientId: number,
    data: {
        name: string;
        sex: Sex;
        tel: string;
        email: string;
        address: string;
        birth: Date;
        updated_at: Date;
    }
): Prisma.PrismaPromise<Prisma.patientsGetPayload<{}>> =>
    prisma.patients.update({
        where: { id: patientId },
        data,
    });

// 患者データを新規作成する。移植前の doctor/patients.ts の POST / の
// クエリをそのまま移した。select を指定していないため戻り値は全カラム。
export const createPatient = (data: {
    name: string;
    sex: Sex;
    tel: string;
    email: string;
    address: string;
    birth: Date;
    password: string;
}): Prisma.PrismaPromise<Prisma.patientsGetPayload<{}>> => prisma.patients.create({ data });
