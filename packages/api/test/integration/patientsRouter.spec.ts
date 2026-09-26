import { describe, test, expect } from "vitest";
import { prisma } from "@repo/db";
import { verifyPassword } from "@repo/auth/password";
import { derivePatientInitialPassword } from "../../src/domain/patientPassword.js";
import { createDoctorClient } from "../support/trpcTestClient.js";
import { insertDoctor, insertPatient } from "../support/testRecords.js";

const birth = new Date("1990-01-01T00:00:00.000Z");

describe("doctor.patients.list / byId", () => {
    test("一覧はパスワードを含まない", async () => {
        const patient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());

        await expect(client.doctor.patients.list.query()).resolves.toEqual([
            {
                id: patient.id,
                name: "患者 花子",
                email: "patient@example.com",
                tel: "090-0000-0000",
                sex: "no_answer",
                address: "東京都",
                birth,
            },
        ]);
    });

    test("存在しない患者は NOT_FOUND になる", async () => {
        const client = await createDoctorClient(await insertDoctor());

        await expect(client.doctor.patients.byId.query({ patientId: 999 })).rejects.toMatchObject({
            data: { code: "NOT_FOUND" },
        });
    });
});

describe("doctor.patients.create", () => {
    test("生年月日から導出した初期パスワードをハッシュ化して保存し、レスポンスにはパスワードを含まない", async () => {
        const client = await createDoctorClient(await insertDoctor());

        const createdPatient = await client.doctor.patients.create.mutate({
            name: "患者 太郎",
            email: "new-patient@example.com",
            tel: "080-1111-2222",
            sex: "man",
            address: "大阪府",
            birth,
        });

        expect(createdPatient).toEqual({
            id: 1,
            name: "患者 太郎",
            email: "new-patient@example.com",
            tel: "080-1111-2222",
            sex: "man",
            address: "大阪府",
            birth,
        });
        const storedPatient = await prisma.patients.findUniqueOrThrow({ where: { id: 1 } });
        await expect(
            verifyPassword(storedPatient.password, derivePatientInitialPassword(birth))
        ).resolves.toBe(true);
    });

    test("登録済みのメールアドレスでは BAD_REQUEST になり、患者は増えない", async () => {
        await insertPatient({ email: "taken@example.com" });
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.patients.create.mutate({
                name: "患者 太郎",
                email: "taken@example.com",
                tel: "080-1111-2222",
                sex: "man",
                address: "大阪府",
                birth,
            })
        ).rejects.toMatchObject({
            data: { code: "BAD_REQUEST" },
            message: "データの登録に失敗しました。",
        });
        await expect(prisma.patients.count()).resolves.toBe(1);
    });
});

describe("doctor.patients.update", () => {
    test("入力した内容で更新される", async () => {
        const patient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());

        await client.doctor.patients.update.mutate({
            id: patient.id,
            name: "患者 花子（改姓）",
            email: "renamed@example.com",
            tel: "070-3333-4444",
            sex: "woman",
            address: "福岡県",
            birth,
        });

        await expect(client.doctor.patients.byId.query({ patientId: patient.id })).resolves.toEqual({
            id: patient.id,
            name: "患者 花子（改姓）",
            email: "renamed@example.com",
            tel: "070-3333-4444",
            sex: "woman",
            address: "福岡県",
            birth,
        });
    });

    test("性別に選択肢に無い値を渡すと BAD_REQUEST になり、患者は変わらない", async () => {
        const patient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.patients.update.mutate({
                id: patient.id,
                name: "患者 花子（改姓）",
                email: "renamed@example.com",
                tel: "070-3333-4444",
                sex: "unknown",
                address: "福岡県",
                birth,
            })
        ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });

        await expect(
            prisma.patients.findUniqueOrThrow({ where: { id: patient.id } })
        ).resolves.toMatchObject({ name: "患者 花子", email: "patient@example.com", sex: "no_answer" });
    });
});
