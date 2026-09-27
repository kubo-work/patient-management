import { describe, test, expect } from "vitest";
import { prisma } from "@repo/db";
import {
    createMedicalRecord,
    findMedicalRecordsPageByPatient,
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
        const parentCategory = await insertCategory("保険適用施術");
        const childCategory = await insertCategory("電気療法", parentCategory.id);

        await createMedicalRecord(
            {
                patient_id: patientId,
                doctor_id: doctorId,
                medical_memo: "右足首を捻った",
                doctor_memo: "経過観察",
                examination_at: DEFAULT_EXAMINATION_AT,
            },
            [childCategory.id]
        );

        await expect(
            findMedicalRecordsPageByPatient(patientId, {
                page: 1,
                pageSize: 10,
                sortBy: "id",
                sortOrder: "desc",
            })
        ).resolves.toEqual({
            items: [
                {
                    id: 1,
                    patient_id: patientId,
                    doctor_id: doctorId,
                    medical_memo: "右足首を捻った",
                    doctor_memo: "経過観察",
                    examination_at: DEFAULT_EXAMINATION_AT,
                    medical_categories: [
                        { categories: { id: childCategory.id, treatment: "電気療法" } },
                    ],
                },
            ],
            totalCount: 1,
        });
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

// medical_records の doctor / patient は onDelete: Restrict。診療記録は医療の記録なので、
// 医師や患者の削除に巻き込んで消したり参照先を失わせたりせず、削除そのものを拒否する（#322）。
// 以前は SetDefault だったが、列が NOT NULL で既定値も無いため NOT NULL 違反（P2011）で
// 失敗しており、拒否の理由が意図と食い違っていた。
describe("medical_records の外部キー（onDelete: Restrict）", () => {
    test("診療記録を持つ医師は、外部キー違反で削除できない", async () => {
        const { doctorId, patientId } = await createDoctorAndPatient();
        await createRecordWithoutCategories(doctorId, patientId);

        // P2003 = 外部キー制約違反（Postgres の 23503）。
        await expect(prisma.doctors.delete({ where: { id: doctorId } })).rejects.toMatchObject({
            code: "P2003",
        });
        await expect(prisma.doctors.count()).resolves.toBe(1);
        await expect(prisma.medical_records.findFirstOrThrow()).resolves.toMatchObject({
            doctor_id: doctorId,
        });
    });

    test("診療記録を持つ患者は、外部キー違反で削除できない", async () => {
        const { doctorId, patientId } = await createDoctorAndPatient();
        await createRecordWithoutCategories(doctorId, patientId);

        await expect(prisma.patients.delete({ where: { id: patientId } })).rejects.toMatchObject({
            code: "P2003",
        });
        await expect(prisma.patients.count()).resolves.toBe(1);
    });

    test("診療記録を持たない医師は削除できる", async () => {
        const { doctorId } = await createDoctorAndPatient();

        await prisma.doctors.delete({ where: { id: doctorId } });

        await expect(prisma.doctors.count()).resolves.toBe(0);
    });
});
