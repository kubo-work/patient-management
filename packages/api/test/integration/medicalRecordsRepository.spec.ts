import { describe, test, expect } from "vitest";
import { prisma } from "@repo/db";
import {
    createMedicalRecord,
    findMedicalRecordsByPatient,
} from "../../src/repository/medicalRecords.js";
import {
    DEFAULT_EXAMINATION_AT,
    insertCategory,
    insertDoctor,
    insertPatient,
    NONEXISTENT_ID,
} from "../support/testRecords.js";

const createDoctorAndPatient = async (): Promise<{ doctorId: number; patientId: number }> => {
    const doctor = await insertDoctor();
    const patient = await insertPatient();
    return { doctorId: doctor.id, patientId: patient.id };
};

const createRecordWithoutCategories = (doctorId: number, patientId: number): Promise<void> =>
    createMedicalRecord(
        {
            patient_id: patientId,
            doctor_id: doctorId,
            medical_memo: "",
            doctor_memo: "",
            examination_at: DEFAULT_EXAMINATION_AT,
        },
        []
    );

describe("createMedicalRecord", () => {
    test("診療記録と診療カテゴリを保存し、患者ごとの一覧で読み戻せる", async () => {
        const { doctorId, patientId } = await createDoctorAndPatient();
        const parentCategory = await insertCategory("内科");
        const childCategory = await insertCategory("風邪", parentCategory.id);

        await createMedicalRecord(
            {
                patient_id: patientId,
                doctor_id: doctorId,
                medical_memo: "咳が続く",
                doctor_memo: "経過観察",
                examination_at: DEFAULT_EXAMINATION_AT,
            },
            [childCategory.id]
        );

        await expect(findMedicalRecordsByPatient(patientId)).resolves.toEqual([
            {
                id: 1,
                patient_id: patientId,
                doctor_id: doctorId,
                medical_memo: "咳が続く",
                doctor_memo: "経過観察",
                examination_at: DEFAULT_EXAMINATION_AT,
                medical_categories: [
                    { categories: { id: childCategory.id, treatment: "風邪" } },
                ],
            },
        ]);
    });

    test("存在しないカテゴリを渡すとトランザクション全体が取り消され、診療記録も残らない", async () => {
        const { doctorId, patientId } = await createDoctorAndPatient();

        await expect(
            createMedicalRecord(
                {
                    patient_id: patientId,
                    doctor_id: doctorId,
                    medical_memo: "",
                    doctor_memo: "",
                    examination_at: DEFAULT_EXAMINATION_AT,
                },
                [NONEXISTENT_ID]
            )
        ).rejects.toMatchObject({ code: "P2003" });

        await expect(prisma.medical_records.count()).resolves.toBe(0);
    });
});

// schema.prisma は medical_records の doctor / patient を onDelete: SetDefault としているが、
// doctor_id / patient_id は NOT NULL かつ既定値を持たない。そのため SET DEFAULT は NULL を
// 入れようとして NOT NULL 制約に違反し、削除は失敗する（事実上の RESTRICT）。
// 現在 API に医師・患者の削除は無いが、この挙動を前提にした設計変更に気付けるよう固定する。
describe("medical_records の外部キー（onDelete: SetDefault）", () => {
    test("診療記録を持つ医師は削除できない", async () => {
        const { doctorId, patientId } = await createDoctorAndPatient();
        await createRecordWithoutCategories(doctorId, patientId);

        // P2011 = NOT NULL 制約違反（Postgres の 23502）。外部キー違反（P2003）ではない。
        await expect(prisma.doctors.delete({ where: { id: doctorId } })).rejects.toMatchObject({
            code: "P2011",
        });
        await expect(prisma.doctors.count()).resolves.toBe(1);
        await expect(prisma.medical_records.findFirstOrThrow()).resolves.toMatchObject({
            doctor_id: doctorId,
        });
    });

    test("診療記録を持つ患者は削除できない", async () => {
        const { doctorId, patientId } = await createDoctorAndPatient();
        await createRecordWithoutCategories(doctorId, patientId);

        await expect(prisma.patients.delete({ where: { id: patientId } })).rejects.toMatchObject({
            code: "P2011",
        });
        await expect(prisma.patients.count()).resolves.toBe(1);
    });
});
