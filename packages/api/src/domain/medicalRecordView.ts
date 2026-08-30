import type { MedicalRecordsType, BasicCategoriesType } from "@repo/schema";

// Prisma のネストした取得結果は medical_categories[].categories という形になるが、
// フロントが期待するのは categories の平坦な配列である。移植前は router の中で
// map していた。@repo/schema は型のみのパッケージなので domain から参照してよい。
type MedicalRecordRow = Omit<MedicalRecordsType, "categories"> & {
    medical_categories: { categories: BasicCategoriesType }[];
};

export const toMedicalRecordView = (row: MedicalRecordRow): MedicalRecordsType => {
    const {
        id,
        patient_id,
        doctor_id,
        examination_at,
        medical_memo,
        doctor_memo,
        medical_categories,
    } = row;
    return {
        id,
        patient_id,
        doctor_id,
        examination_at,
        medical_memo,
        doctor_memo,
        categories: medical_categories.flatMap((medicalCategory) => medicalCategory.categories),
    };
};
