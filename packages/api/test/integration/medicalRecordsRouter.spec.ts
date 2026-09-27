import { describe, test, expect } from "vitest";
import type { inferRouterInputs } from "@trpc/server";
import { prisma } from "@repo/db";
import type { AppRouter } from "../../src/app.js";
import { createDoctorClient } from "../support/trpcTestClient.js";
import {
    DEFAULT_EXAMINATION_AT,
    insertCategory,
    insertDoctor,
    insertPatient,
    NONEXISTENT_ID,
} from "../support/testRecords.js";

type MedicalRecordCreateInput = inferRouterInputs<AppRouter>["doctor"]["medicalRecords"]["create"];

// 誰の記録かだけを必須にし、検証に関係しない項目は既定値で埋める。
const buildMedicalRecordInput = (
    overrides: Partial<MedicalRecordCreateInput> &
        Pick<MedicalRecordCreateInput, "patient_id" | "doctor_id">
): MedicalRecordCreateInput => ({
    examination_at: DEFAULT_EXAMINATION_AT,
    medical_memo: "",
    doctor_memo: "",
    categories: [],
    ...overrides,
});

const prepareDoctorPatientAndCategories = async () => {
    const doctor = await insertDoctor();
    const patient = await insertPatient();
    const insuranceTreatment = await insertCategory("保険適用施術");
    const electricTherapy = await insertCategory("電気療法", insuranceTreatment.id);
    const manualTherapy = await insertCategory("手技療法", insuranceTreatment.id);
    const reductionAndFixation = await insertCategory("整復・固定", insuranceTreatment.id);
    const client = await createDoctorClient(doctor);
    return { doctor, patient, electricTherapy, manualTherapy, reductionAndFixation, client };
};

type DoctorClient = Awaited<ReturnType<typeof createDoctorClient>>;

// 画面の既定と同じく、新しい順（id の降順）の 1 ページ目を取得する。
const queryNewestFirstPage = (client: DoctorClient, patientId: number) =>
    client.doctor.medicalRecords.page.query({
        patientId,
        page: 1,
        pageSize: 10,
        sortBy: "id",
        sortOrder: "desc",
    });

describe("doctor.medicalRecords.create / page", () => {
    test("登録した診療記録を、カテゴリを平坦化した形で患者ごとに新しい順で返す", async () => {
        const { doctor, patient, electricTherapy, manualTherapy, client } = await prepareDoctorPatientAndCategories();
        const otherPatient = await insertPatient({ email: "other@example.com" });
        const firstInput = buildMedicalRecordInput({
            patient_id: patient.id,
            doctor_id: doctor.id,
            medical_memo: "1 回目",
            categories: [String(electricTherapy.id)],
        });
        const secondInput = buildMedicalRecordInput({
            patient_id: patient.id,
            doctor_id: doctor.id,
            examination_at: new Date("2026-09-08T09:00:00.000Z"),
            medical_memo: "2 回目",
            doctor_memo: "再診",
            categories: [String(manualTherapy.id)],
        });

        await client.doctor.medicalRecords.create.mutate(firstInput);
        await client.doctor.medicalRecords.create.mutate(secondInput);
        await client.doctor.medicalRecords.create.mutate(
            buildMedicalRecordInput({ patient_id: otherPatient.id, doctor_id: doctor.id })
        );

        // create は id を返さないため、空の DB から登録した順の採番（1, 2）で特定する。
        await expect(queryNewestFirstPage(client, patient.id)).resolves.toEqual({
            items: [
                { ...secondInput, id: 2, categories: [{ id: manualTherapy.id, treatment: "手技療法" }] },
                { ...firstInput, id: 1, categories: [{ id: electricTherapy.id, treatment: "電気療法" }] },
            ],
            totalCount: 2,
        });
    });

    test("存在しない患者を指定すると BAD_REQUEST になり、何も保存されない", async () => {
        const { doctor, electricTherapy, client } = await prepareDoctorPatientAndCategories();

        await expect(
            client.doctor.medicalRecords.create.mutate(
                buildMedicalRecordInput({
                    patient_id: NONEXISTENT_ID,
                    doctor_id: doctor.id,
                    categories: [String(electricTherapy.id)],
                })
            )
        ).rejects.toMatchObject({
            data: { code: "BAD_REQUEST" },
            message: "データの保存に失敗しました。",
        });
        await expect(prisma.medical_records.count()).resolves.toBe(0);
        await expect(prisma.medical_categories.count()).resolves.toBe(0);
    });
});

describe("doctor.medicalRecords.page", () => {
    test("診察日で並べた 1 ページ分と、その患者の全件数を返す", async () => {
        const { doctor, patient, client } = await prepareDoctorPatientAndCategories();
        const otherPatient = await insertPatient({ email: "other@example.com" });
        const examinationDates = ["2026-09-10", "2026-09-03", "2026-09-17"].map(
            (date) => new Date(`${date}T09:00:00.000Z`)
        );
        for (const examination_at of examinationDates) {
            await client.doctor.medicalRecords.create.mutate(
                buildMedicalRecordInput({ patient_id: patient.id, doctor_id: doctor.id, examination_at })
            );
        }
        await client.doctor.medicalRecords.create.mutate(
            buildMedicalRecordInput({ patient_id: otherPatient.id, doctor_id: doctor.id })
        );

        const oldestFirstPage = await client.doctor.medicalRecords.page.query({
            patientId: patient.id,
            page: 1,
            pageSize: 10,
            sortBy: "examination_at",
            sortOrder: "asc",
        });

        expect(oldestFirstPage.items.map((medicalRecord) => medicalRecord.examination_at)).toEqual([
            examinationDates[1],
            examinationDates[0],
            examinationDates[2],
        ]);
        expect(oldestFirstPage.totalCount).toBe(3);
    });
});

describe("doctor.medicalRecords.update", () => {
    test("メモを更新し、カテゴリを指定したものへ差分で入れ替える", async () => {
        const { doctor, patient, electricTherapy, manualTherapy, reductionAndFixation, client } =
            await prepareDoctorPatientAndCategories();
        const createdInput = buildMedicalRecordInput({
            patient_id: patient.id,
            doctor_id: doctor.id,
            medical_memo: "初診",
            categories: [String(electricTherapy.id), String(manualTherapy.id)],
        });
        await client.doctor.medicalRecords.create.mutate(createdInput);
        const keptMedicalCategory = await prisma.medical_categories.findFirstOrThrow({
            where: { category_id: manualTherapy.id },
        });

        await client.doctor.medicalRecords.update.mutate({
            ...createdInput,
            id: 1,
            medical_memo: "初診（追記）",
            doctor_memo: "要経過観察",
            categories: [String(manualTherapy.id), String(reductionAndFixation.id)],
        });

        const { items: medicalRecords } = await queryNewestFirstPage(client, patient.id);
        // medical_categories の取得順は select で指定していないため、順序を問わずに比べる。
        expect(medicalRecords).toEqual([
            expect.objectContaining({
                medical_memo: "初診（追記）",
                doctor_memo: "要経過観察",
                categories: expect.arrayContaining([
                    { id: manualTherapy.id, treatment: "手技療法" },
                    { id: reductionAndFixation.id, treatment: "整復・固定" },
                ]),
            }),
        ]);
        expect(medicalRecords.flatMap((medicalRecord) => medicalRecord.categories)).toHaveLength(2);
        // 残したカテゴリは削除・再作成されず、元の行がそのまま残る（差分更新であることの確認）。
        await expect(
            prisma.medical_categories.findFirstOrThrow({ where: { category_id: manualTherapy.id } })
        ).resolves.toMatchObject({ id: keptMedicalCategory.id });
    });
});

describe("doctor.medicalRecords.remove", () => {
    test("論理削除した診療記録は一覧に出ず、紐づくカテゴリも論理削除される", async () => {
        const { doctor, patient, electricTherapy, client } = await prepareDoctorPatientAndCategories();
        await client.doctor.medicalRecords.create.mutate(
            buildMedicalRecordInput({
                patient_id: patient.id,
                doctor_id: doctor.id,
                categories: [String(electricTherapy.id)],
            })
        );

        await client.doctor.medicalRecords.remove.mutate({ id: 1 });

        await expect(queryNewestFirstPage(client, patient.id)).resolves.toEqual({
            items: [],
            totalCount: 0,
        });
        await expect(
            prisma.medical_records.findUniqueOrThrow({ where: { id: 1 } })
        ).resolves.toMatchObject({ delFlag: "DELETED" });
        await expect(prisma.medical_categories.findMany()).resolves.toEqual([
            expect.objectContaining({ medical_record_id: 1, delFlag: "DELETED" }),
        ]);
    });
});
