import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc/init.js";
import { toMedicalRecordView } from "../domain/medicalRecordView.js";
import {
    createMedicalRecord,
    findMedicalRecordsByPatient,
    removeMedicalRecord,
    updateMedicalRecord,
} from "../repository/medicalRecords.js";

// Prisma から返る行の形状を検証する。移植前の doctor/medical_records.ts の
// getMedicalRecordSchema をそのまま移した（フィールド順も同じ）。
// toMedicalRecordView に渡す前段の防御であり、パース後の平坦化を domain へ委ねる。
const medicalRecordRowSchema = z.object({
    id: z.number(),
    patient_id: z.number(),
    examination_at: z.date(),
    medical_memo: z.string(),
    doctor_memo: z.string(),
    doctor_id: z.number(),
    medical_categories: z.array(
        z.object({
            categories: z.object({
                id: z.number(),
                treatment: z.string(),
            }),
        })
    ),
});
const medicalRecordRowsSchema = z.array(medicalRecordRowSchema);

// update/create の record 部分のフィールドは .input() で number/string/Date として
// 直接検証しており、移植前の updateMedicalRecordSchema / createMedicalRecordSchema
// による二重の zod 検証は不要になった（router/patients.ts の update/create と同じ
// 整理）。examination_at は superjson により tRPC の境界で Date に復元されるため、
// 移植前にあった z.string().transform(Date 化) も不要になる（ADR 0003 決定 6）。
const medicalRecordFieldsSchema = {
    patient_id: z.number(),
    doctor_id: z.number(),
    examination_at: z.date(),
    medical_memo: z.string(),
    doctor_memo: z.string(),
    categories: z.array(z.string()),
};

export const medicalRecordsRouter = router({
    // 期間での絞り込みは #305 で UI とセットで設計し直す。移植前の受け口は
    // フロントから一度も呼ばれておらず、絞り込みの実装も無効化されていた。
    byPatient: protectedProcedure
        .input(z.object({ patientId: z.number() }))
        .query(async ({ input }) => {
            try {
                const rows = medicalRecordRowsSchema.parse(
                    await findMedicalRecordsByPatient(input.patientId)
                );
                return rows.map((row) => toMedicalRecordView(row));
            } catch {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの取得に失敗しました。",
                });
            }
        }),

    update: protectedProcedure
        .input(z.object({ id: z.number(), ...medicalRecordFieldsSchema }))
        .mutation(async ({ input }) => {
            const { id, patient_id, doctor_id, examination_at, medical_memo, doctor_memo, categories } =
                input;
            const updated_at: Date = new Date();
            const desiredCategoryIds: number[] = categories.map((category) => Number(category));

            try {
                await updateMedicalRecord(
                    id,
                    { patient_id, doctor_id, medical_memo, doctor_memo, examination_at, updated_at },
                    desiredCategoryIds
                );
            } catch {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの更新に失敗しました。",
                });
            }
        }),

    create: protectedProcedure
        .input(z.object(medicalRecordFieldsSchema))
        .mutation(async ({ input }) => {
            const { patient_id, doctor_id, examination_at, medical_memo, doctor_memo, categories } = input;
            const categoryIds: number[] = categories.map((category) => Number(category));

            try {
                await createMedicalRecord(
                    { patient_id, doctor_id, medical_memo, doctor_memo, examination_at },
                    categoryIds
                );
            } catch {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの保存に失敗しました。",
                });
            }
        }),

    remove: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
            try {
                await removeMedicalRecord(input.id);
            } catch {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "データの削除に失敗しました。",
                });
            }
        }),
});
