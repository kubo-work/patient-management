import { prisma, Prisma, delFlag } from "@repo/db";
import { z } from "zod";
import { diffMedicalCategories } from "../domain/medicalCategoryDiff.js";

// select を satisfies で型付けした上で戻り値型を明示しているのは、
// tsconfig の declaration: true 下で推論に任せると TS2883
// （PrismaPromise を含む推論結果を .d.ts に書き出せない）で
// ビルドが失敗するため。Prisma 7 の生成クライアント構造に起因する制約で、
// クエリの内容自体は移植前の doctor/medical_records.ts と変えていない。
const medicalRecordSelect = {
    id: true,
    patient_id: true,
    examination_at: true,
    medical_memo: true,
    doctor_memo: true,
    doctor_id: true,
    medical_categories: {
        select: {
            categories: {
                select: {
                    id: true,
                    treatment: true,
                },
            },
        },
    },
} satisfies Prisma.medical_recordsSelect;

// 選択した患者の診察履歴一覧を取得する。移植前の doctor/medical_records.ts の
// GET /:patient_id にあった where 句（patient_id と delFlag: ACTIVE の AND）と
// orderBy はそのまま移した。移植前にあった validStartDate / validEndDate の
// 計算と、コメントアウトされた examination_at の日付フィルタは、どこからも
// 使われていない死んだコードだったため移植しない（task-4-brief.md 必須 4）。
export const findMedicalRecordsByPatient = (
    patientId: number
): Prisma.PrismaPromise<
    Array<Prisma.medical_recordsGetPayload<{ select: typeof medicalRecordSelect }>>
> =>
    prisma.medical_records.findMany({
        select: medicalRecordSelect,
        where: {
            AND: [{ patient_id: patientId }, { delFlag: delFlag.ACTIVE }],
        },
        orderBy: {
            id: "desc",
        },
    });

// medical_categories への createMany 直前の形状検証。移植前の
// doctor/medical_records.ts の createMedicalCategoriesSchema をそのまま移した。
// カテゴリ ID の由来（PUT は diffMedicalCategories の結果、POST は入力そのもの）が
// 変わっても、DB へ書き込む直前の検証は変えないため repository 側に置く。
const medicalCategorySchema = z.object({
    medical_record_id: z.number(),
    category_id: z.number(),
});
const medicalCategoriesSchema = z.array(medicalCategorySchema);
type MedicalCategoryInsert = z.infer<typeof medicalCategorySchema>;

type MedicalRecordFields = {
    patient_id: number;
    doctor_id: number;
    medical_memo: string;
    doctor_memo: string;
    examination_at: Date;
};

// 診察履歴を更新し、カテゴリの紐付けを指定に合わせて差し替える。
// $transaction の中身（更新 → 既存カテゴリ取得 → 差分算出 → 削除 → 追加）の
// 順序と条件は移植前の doctor/medical_records.ts の PUT / と同じ。
// 差分算出だけを diffMedicalCategories の呼び出しへ置き換えている
// （task-4-brief.md 必須）。$transaction のコールバックは値を返さないため、
// 戻り値は Promise<void> になる（移植前も result は undefined だった）。
export const updateMedicalRecord = (
    medicalRecordId: number,
    data: MedicalRecordFields & { updated_at: Date },
    desiredCategoryIds: number[]
): Promise<void> =>
    prisma.$transaction(async (transactionClient) => {
        await transactionClient.medical_records.update({
            where: { id: medicalRecordId },
            data,
        });

        // 1. 現在の medical_categories を取得
        const existingCategories = await transactionClient.medical_categories.findMany({
            where: {
                medical_record_id: medicalRecordId,
            },
        });
        const existingCategoryIds: number[] = existingCategories.map(
            (category) => category.category_id
        );

        // 2・3. 削除すべきカテゴリ・追加すべきカテゴリの算出を
        // domain/medicalCategoryDiff.ts へ切り出した
        const { categoryIdsToDelete, categoryIdsToAdd } = diffMedicalCategories(
            existingCategoryIds,
            desiredCategoryIds
        );

        // 4. 削除
        if (categoryIdsToDelete.length > 0) {
            await transactionClient.medical_categories.deleteMany({
                where: {
                    medical_record_id: medicalRecordId,
                    category_id: { in: categoryIdsToDelete },
                },
            });
        }

        // 5. 追加
        if (categoryIdsToAdd.length > 0) {
            const newMedicalCategories = categoryIdsToAdd.map((categoryId) => ({
                medical_record_id: medicalRecordId,
                category_id: categoryId,
            }));
            const validatedMedicalCategories: MedicalCategoryInsert[] =
                medicalCategoriesSchema.parse(newMedicalCategories);
            await transactionClient.medical_categories.createMany({
                data: validatedMedicalCategories,
            });
        }
    });

// 診察履歴を新規作成し、指定されたカテゴリを紐付ける。移植前の
// doctor/medical_records.ts の POST / の $transaction をそのまま移した。
export const createMedicalRecord = (
    data: MedicalRecordFields,
    categoryIds: number[]
): Promise<void> =>
    prisma.$transaction(async (transactionClient) => {
        const newMedicalRecord = await transactionClient.medical_records.create({
            data,
        });

        const medicalRecordId = newMedicalRecord.id;
        if (categoryIds.length) {
            const postMedicalCategoriesData = categoryIds.map((categoryId) => ({
                medical_record_id: medicalRecordId,
                category_id: categoryId,
            }));
            const validatedMedicalCategories: MedicalCategoryInsert[] =
                medicalCategoriesSchema.parse(postMedicalCategoriesData);
            await transactionClient.medical_categories.createMany({
                data: validatedMedicalCategories,
            });
        }
    });

// 診察履歴を論理削除する。移植前の doctor/medical_records.ts の DELETE / の
// $transaction をそのまま移した。medical_records の delFlag 更新 →
// 紐づく medical_categories の delFlag 更新、という順序も変えていない。
export const removeMedicalRecord = (medicalRecordId: number): Promise<void> =>
    prisma.$transaction(async (transactionClient) => {
        await transactionClient.medical_records.update({
            data: {
                delFlag: delFlag.DELETED,
            },
            where: {
                id: medicalRecordId,
            },
        });

        await transactionClient.medical_categories.updateMany({
            data: {
                delFlag: delFlag.DELETED,
            },
            where: {
                medical_record_id: medicalRecordId,
            },
        });
    });
