import { describe, test, expect } from "vitest";
import { prisma } from "@repo/db";
import { createDoctorClient } from "../support/trpcTestClient.js";
import { insertCategory, insertDoctor, insertPatient } from "../support/testRecords.js";

// medical_categories の取得順は select で指定していないため、id で並べてから比べる。
const sortedCategoryIds = (categories: { id: number }[]): number[] =>
    categories.map((category) => category.id).sort((left, right) => left - right);

const prepare = async () => {
    const doctor = await insertDoctor();
    const patient = await insertPatient();
    const internalMedicine = await insertCategory("内科");
    const cold = await insertCategory("風邪", internalMedicine.id);
    const influenza = await insertCategory("インフルエンザ", internalMedicine.id);
    const headache = await insertCategory("頭痛", internalMedicine.id);
    const client = await createDoctorClient(doctor);
    return { doctor, patient, cold, influenza, headache, client };
};

describe("doctor.medicalRecords.create / byPatient", () => {
    test("登録した診療記録を、カテゴリを平坦化した形で患者ごとに新しい順で返す", async () => {
        const { doctor, patient, cold, influenza, client } = await prepare();
        const otherPatient = await insertPatient({ email: "other@example.com" });

        await client.doctor.medicalRecords.create.mutate({
            patient_id: patient.id,
            doctor_id: doctor.id,
            examination_at: new Date("2026-09-01T09:00:00.000Z"),
            medical_memo: "1 回目",
            doctor_memo: "",
            categories: [String(cold.id)],
        });
        await client.doctor.medicalRecords.create.mutate({
            patient_id: patient.id,
            doctor_id: doctor.id,
            examination_at: new Date("2026-09-08T09:00:00.000Z"),
            medical_memo: "2 回目",
            doctor_memo: "再診",
            categories: [String(influenza.id)],
        });
        await client.doctor.medicalRecords.create.mutate({
            patient_id: otherPatient.id,
            doctor_id: doctor.id,
            examination_at: new Date("2026-09-08T10:00:00.000Z"),
            medical_memo: "別の患者",
            doctor_memo: "",
            categories: [],
        });

        await expect(
            client.doctor.medicalRecords.byPatient.query({ patientId: patient.id })
        ).resolves.toEqual([
            {
                id: 2,
                patient_id: patient.id,
                doctor_id: doctor.id,
                examination_at: new Date("2026-09-08T09:00:00.000Z"),
                medical_memo: "2 回目",
                doctor_memo: "再診",
                categories: [{ id: influenza.id, treatment: "インフルエンザ" }],
            },
            {
                id: 1,
                patient_id: patient.id,
                doctor_id: doctor.id,
                examination_at: new Date("2026-09-01T09:00:00.000Z"),
                medical_memo: "1 回目",
                doctor_memo: "",
                categories: [{ id: cold.id, treatment: "風邪" }],
            },
        ]);
    });

    test("存在しない患者を指定すると BAD_REQUEST になり、何も保存されない", async () => {
        const { doctor, cold, client } = await prepare();

        await expect(
            client.doctor.medicalRecords.create.mutate({
                patient_id: 999,
                doctor_id: doctor.id,
                examination_at: new Date("2026-09-01T09:00:00.000Z"),
                medical_memo: "",
                doctor_memo: "",
                categories: [String(cold.id)],
            })
        ).rejects.toMatchObject({
            data: { code: "BAD_REQUEST" },
            message: "データの保存に失敗しました。",
        });
        await expect(prisma.medical_records.count()).resolves.toBe(0);
        await expect(prisma.medical_categories.count()).resolves.toBe(0);
    });
});

describe("doctor.medicalRecords.update", () => {
    test("メモを更新し、カテゴリを指定したものへ差分で入れ替える", async () => {
        const { doctor, patient, cold, influenza, headache, client } = await prepare();
        await client.doctor.medicalRecords.create.mutate({
            patient_id: patient.id,
            doctor_id: doctor.id,
            examination_at: new Date("2026-09-01T09:00:00.000Z"),
            medical_memo: "初診",
            doctor_memo: "",
            categories: [String(cold.id), String(influenza.id)],
        });
        const keptMedicalCategory = await prisma.medical_categories.findFirstOrThrow({
            where: { category_id: influenza.id },
        });

        await client.doctor.medicalRecords.update.mutate({
            id: 1,
            patient_id: patient.id,
            doctor_id: doctor.id,
            examination_at: new Date("2026-09-01T09:00:00.000Z"),
            medical_memo: "初診（追記）",
            doctor_memo: "要経過観察",
            categories: [String(influenza.id), String(headache.id)],
        });

        const [updatedRecord] = await client.doctor.medicalRecords.byPatient.query({
            patientId: patient.id,
        });
        expect(updatedRecord).toMatchObject({ medical_memo: "初診（追記）", doctor_memo: "要経過観察" });
        expect(sortedCategoryIds(updatedRecord!.categories)).toEqual([influenza.id, headache.id]);
        // 残したカテゴリは削除・再作成されず、元の行がそのまま残る（差分更新であることの確認）。
        await expect(
            prisma.medical_categories.findFirstOrThrow({ where: { category_id: influenza.id } })
        ).resolves.toMatchObject({ id: keptMedicalCategory.id });
    });
});

describe("doctor.medicalRecords.remove", () => {
    test("論理削除した診療記録は一覧に出ず、紐づくカテゴリも論理削除される", async () => {
        const { doctor, patient, cold, client } = await prepare();
        await client.doctor.medicalRecords.create.mutate({
            patient_id: patient.id,
            doctor_id: doctor.id,
            examination_at: new Date("2026-09-01T09:00:00.000Z"),
            medical_memo: "",
            doctor_memo: "",
            categories: [String(cold.id)],
        });

        await client.doctor.medicalRecords.remove.mutate({ id: 1 });

        await expect(
            client.doctor.medicalRecords.byPatient.query({ patientId: patient.id })
        ).resolves.toEqual([]);
        await expect(
            prisma.medical_records.findUniqueOrThrow({ where: { id: 1 } })
        ).resolves.toMatchObject({ delFlag: "DELETED" });
        await expect(prisma.medical_categories.findMany()).resolves.toEqual([
            expect.objectContaining({ medical_record_id: 1, delFlag: "DELETED" }),
        ]);
    });
});
