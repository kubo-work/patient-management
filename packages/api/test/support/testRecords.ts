import { prisma } from "@repo/db";
import { hashPassword } from "@repo/auth/password";

// 結合テストの前提データを Prisma で直接投入する。
// 検証対象の procedure を経由しないことで、前提の作成と検証を切り離す。

export const insertDoctor = async (
    overrides: { name?: string; email?: string; plainPassword?: string } = {}
) => {
    const { name = "医師 一郎", email = "doctor@example.com", plainPassword = "doctor-password" } =
        overrides;
    return prisma.doctors.create({
        data: { name, email, password: await hashPassword(plainPassword) },
    });
};

export const insertPatient = (overrides: { name?: string; email?: string } = {}) => {
    const { name = "患者 花子", email = "patient@example.com" } = overrides;
    return prisma.patients.create({
        data: {
            name,
            email,
            // 患者のログインはまだ無く、パスワードを検証するテストも無いため、ハッシュ化しない。
            password: "unused-patient-password",
            tel: "090-0000-0000",
            address: "東京都",
            birth: new Date("1990-01-01T00:00:00.000Z"),
        },
    });
};

export const insertCategory = (treatment: string, parentId?: number) =>
    prisma.categories.create({ data: { treatment, parent_id: parentId ?? null } });
