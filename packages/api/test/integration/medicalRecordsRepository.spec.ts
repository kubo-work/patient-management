import { describe, test, expect } from "vitest";
import { prisma } from "@repo/db";
import {
    createMedicalRecord,
    findMedicalRecordsByPatient,
} from "../../src/repository/medicalRecords.js";

const createDoctorAndPatient = async (): Promise<{ doctorId: number; patientId: number }> => {
    const doctor = await prisma.doctors.create({
        data: { name: "医師 一郎", email: "doctor@example.com", password: "unused-hash" },
    });
    const patient = await prisma.patients.create({
        data: {
            name: "患者 花子",
            email: "patient@example.com",
            password: "unused-hash",
            tel: "090-0000-0000",
            address: "東京都",
            birth: new Date("1990-01-01T00:00:00.000Z"),
        },
    });
    return { doctorId: doctor.id, patientId: patient.id };
};

describe("createMedicalRecord", () => {
    test("診療記録と診療カテゴリを保存し、患者ごとの一覧で読み戻せる", async () => {
        const { doctorId, patientId } = await createDoctorAndPatient();
        const parentCategory = await prisma.categories.create({ data: { treatment: "内科" } });
        const childCategory = await prisma.categories.create({
            data: { treatment: "風邪", parent_id: parentCategory.id },
        });

        await createMedicalRecord(
            {
                patient_id: patientId,
                doctor_id: doctorId,
                medical_memo: "咳が続く",
                doctor_memo: "経過観察",
                examination_at: new Date("2026-09-01T09:00:00.000Z"),
            },
            [childCategory.id]
        );

        const medicalRecords = await findMedicalRecordsByPatient(patientId);
        expect(medicalRecords).toEqual([
            {
                id: 1,
                patient_id: patientId,
                doctor_id: doctorId,
                medical_memo: "咳が続く",
                doctor_memo: "経過観察",
                examination_at: new Date("2026-09-01T09:00:00.000Z"),
                medical_categories: [
                    { categories: { id: childCategory.id, treatment: "風邪" } },
                ],
            },
        ]);
    });

    test("存在しないカテゴリを渡すとトランザクション全体が取り消され、診療記録も残らない", async () => {
        const { doctorId, patientId } = await createDoctorAndPatient();
        const nonexistentCategoryId = 999;

        await expect(
            createMedicalRecord(
                {
                    patient_id: patientId,
                    doctor_id: doctorId,
                    medical_memo: "咳が続く",
                    doctor_memo: "",
                    examination_at: new Date("2026-09-01T09:00:00.000Z"),
                },
                [nonexistentCategoryId]
            )
        ).rejects.toMatchObject({ code: "P2003" });

        await expect(prisma.medical_records.count()).resolves.toBe(0);
    });
});
