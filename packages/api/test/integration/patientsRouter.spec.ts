import { describe, test, expect } from "vitest";
import { prisma } from "@repo/db";
import { verifyPassword } from "@repo/auth/password";
import { derivePatientInitialPassword } from "../../src/domain/patientPassword.js";
import { createDoctorClient } from "../support/trpcTestClient.js";
import { insertDoctor, insertPatient, NONEXISTENT_ID } from "../support/testRecords.js";

type InsertedPatient = Awaited<ReturnType<typeof insertPatient>>;

// API が返す患者の形。パスワードと作成・更新日時は含まない。
const toPatientResponse = ({ id, name, email, tel, sex, address, birth }: InsertedPatient) => ({
    id,
    name,
    email,
    tel,
    sex,
    address,
    birth,
});

const newPatientInput = {
    name: "患者 太郎",
    email: "new-patient@example.com",
    tel: "080-1111-2222",
    sex: "man",
    address: "大阪府",
    birth: new Date("1985-05-05T00:00:00.000Z"),
};

describe("doctor.patients.list / byId", () => {
    test("一覧はパスワードを含まない", async () => {
        const patient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());

        await expect(client.doctor.patients.list.query()).resolves.toEqual([
            toPatientResponse(patient),
        ]);
    });

    test("存在しない患者は NOT_FOUND になる", async () => {
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.patients.byId.query({ patientId: NONEXISTENT_ID })
        ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    });
});

describe("doctor.patients.create", () => {
    test("生年月日から導出した初期パスワードをハッシュ化して保存し、レスポンスにはパスワードを含まない", async () => {
        const client = await createDoctorClient(await insertDoctor());

        const createdPatient = await client.doctor.patients.create.mutate(newPatientInput);

        expect(createdPatient).toEqual({ id: createdPatient.id, ...newPatientInput });
        const storedPatient = await prisma.patients.findUniqueOrThrow({
            where: { id: createdPatient.id },
        });
        await expect(
            verifyPassword(storedPatient.password, derivePatientInitialPassword(newPatientInput.birth))
        ).resolves.toBe(true);
    });

    test("登録済みのメールアドレスでは BAD_REQUEST になり、患者は増えない", async () => {
        const existingPatient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.patients.create.mutate({ ...newPatientInput, email: existingPatient.email })
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
        const updatedPatientInput = { ...newPatientInput, id: patient.id };

        await client.doctor.patients.update.mutate(updatedPatientInput);

        await expect(
            client.doctor.patients.byId.query({ patientId: patient.id })
        ).resolves.toEqual(updatedPatientInput);
    });

    test("性別に選択肢に無い値を渡すと BAD_REQUEST になり、患者は変わらない", async () => {
        const patient = await insertPatient();
        const client = await createDoctorClient(await insertDoctor());

        await expect(
            client.doctor.patients.update.mutate({ ...newPatientInput, id: patient.id, sex: "unknown" })
        ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });

        await expect(
            prisma.patients.findUniqueOrThrow({ where: { id: patient.id } })
        ).resolves.toEqual(patient);
    });
});
