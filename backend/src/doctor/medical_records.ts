import { Request, Response, Router } from "express";
import { MedicalRecordsType } from "../../../common/types/MedicalRecordsType";
import { BasicCategoriesType } from "../../../common/types/BasicCategoriesType";
import { verifyAuthToken } from "../verifyAuthToken.js";
import dayjs from "dayjs";
import { delFlag } from "@prisma/client";
import { prisma } from "../prisma.js";
import { MedicalRecordsCategoryType } from "../../../common/types/MedicalRecordsCategoryType";

const router = Router();

type ResultMedicalRecordsType = Omit<MedicalRecordsType, "categories" | "delFlag"> & {
    medical_categories: {
        categories: BasicCategoriesType;
    }[]
}

// 選択した患者の診察履歴一覧を取得する
router.get("/:patient_id", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const { patient_id }: { patient_id: number } = request.body;
        const { all, startDate, endDate } = request.query; // クエリパラメータから日付を取得

        // 現在の日付
        const now = dayjs();
        // デフォルトで3ヶ月前の日付を計算
        const threeMonthsAgo = now.subtract(3, 'month').toISOString();

        // 開始日と終了日を検証
        const validStartDate = startDate && typeof startDate === "string" ? dayjs(startDate).toISOString() : threeMonthsAgo;
        const validEndDate = endDate && typeof endDate === "string" ? dayjs(endDate).toISOString() : now.toISOString();
        const resultAllMedicalRecords: ResultMedicalRecordsType[] = await prisma.medical_records.findMany({
            select: {
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
                            }
                        }
                    }
                }
            },
            where: {
                AND: [
                    { patient_id }, { delFlag: delFlag.ACTIVE },
                    all && typeof all === "boolean" ? {} : {
                        examination_at: {
                            gte: validStartDate,
                            lte: validEndDate,
                        }
                    }
                ]
            },
            orderBy: {
                id: "desc"
            }
        });
        const allMedicalRecords: MedicalRecordsType[] = resultAllMedicalRecords.map((result) => {
            const { id, patient_id, doctor_id, examination_at, medical_memo, doctor_memo, medical_categories } = result;
            return {
                id,
                patient_id,
                doctor_id,
                examination_at,
                medical_memo,
                doctor_memo,
                categories: medical_categories.flatMap((category) => category.categories)
            }
        })
        return response.json(allMedicalRecords);
    } catch (e) {
        return response.status(400).json({ error: "データの取得に失敗しました。" });
    }
})

type PutMedicalRecordsType = Omit<MedicalRecordsType, "categories"> & { categories: string[] }

router.put("/", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const { id, patient_id, examination_at, doctor_id, medical_memo, doctor_memo, categories }: PutMedicalRecordsType = request.body;
        const updated_at: Date = new Date();
        const medicalRecordId: number = Number(id);
        const categoryNumbers: number[] = categories.map((category) => Number(category))
        const result = await prisma.$transaction(async (prisma) => {
            await prisma.medical_records.update({
                where: { id: medicalRecordId },
                data: {
                    patient_id,
                    doctor_id,
                    medical_memo,
                    doctor_memo,
                    examination_at,
                    updated_at
                },
            });
            // 1. 現在の medical_categories を取得
            const existingCategories = await prisma.medical_categories.findMany({
                where: {
                    medical_record_id: medicalRecordId,
                },
            });

            const existingCategoryIds: number[] = existingCategories.map(cat => cat.category_id);

            // 2. 削除すべきカテゴリを特定
            const categoriesToDelete: number[] = existingCategoryIds.filter(
                categoryId => !categoryNumbers.includes(categoryId)
            );

            // 3. 追加すべきカテゴリを特定
            const categoriesToAdd: number[] = categoryNumbers.filter(
                categoryId => !existingCategoryIds.includes(categoryId)
            );

            // 4. 削除
            if (categoriesToDelete.length > 0) {
                await prisma.medical_categories.deleteMany({
                    where: {
                        medical_record_id: medicalRecordId,
                        category_id: { in: categoriesToDelete },
                    },
                });
            }

            // 5. 追加
            if (categoriesToAdd.length > 0) {
                const newMedicalCategories: MedicalRecordsCategoryType[] = categoriesToAdd.map(categoryId => ({
                    medical_record_id: medicalRecordId,
                    category_id: categoryId,
                }));

                await prisma.medical_categories.createMany({
                    data: newMedicalCategories,
                });
            }
        })
        return response.json({ data: result })
    } catch (e) {
        return response.status(400).json({ error: "データの更新に失敗しました。" });
    }
})

type PostMedicalRecordsType = PutMedicalRecordsType & { doctor_id: string };

router.post("/", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const { patient_id, doctor_id, examination_at, medical_memo, doctor_memo, categories }: PostMedicalRecordsType = request.body;
        const result = await prisma.$transaction(async (prisma) => {
            const newMedicalRecord = await prisma.medical_records.create({
                data: {
                    doctor_id,
                    patient_id,
                    medical_memo,
                    doctor_memo,
                    examination_at
                }
            });

            const medicalRecordId = newMedicalRecord.id;
            if (categories.length) {
                const postMedicalCategoriesData = categories.map((category) => (
                    {
                        medical_record_id: medicalRecordId,
                        category_id: Number(category)
                    }
                ))
                await prisma.medical_categories.createMany({
                    data: postMedicalCategoriesData
                });
            }
        })
        return response.json({ data: result })
    } catch (e) {
        return response.status(400).json({ error: "データの保存に失敗しました。" });
    }
})

router.delete("/", verifyAuthToken, async (request: Request, response: Response) => {
    try {
        const { id } = request.body;
        const result = await prisma.$transaction(async (prisma) => {
            const targetId = Number(id);
            await prisma.medical_records.update({
                data: {
                    delFlag: delFlag.DELETED
                },
                where: {
                    id: targetId
                }
            });

            await prisma.medical_categories.updateMany({
                data: {
                    delFlag: delFlag.DELETED
                },
                where: {
                    medical_record_id: targetId
                }
            });
        })
        return response.json({ data: result })
    } catch (e) {
        return response.status(400).json({ error: "データの削除に失敗しました。" });
    }
});

export default router;
