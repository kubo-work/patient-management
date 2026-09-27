// Prisma のネストした取得結果は medical_categories[].categories という形になるが、
// フロントが期待するのは categories の平坦な配列である。移植前は router の中で
// map していた。
//
// 形は router の zod スキーマ（medicalRecordRowSchema / medicalRecordViewSchema）で決まるため、
// ここでは型を書かず、入力の型から戻り値の型を導く。
type MedicalRecordRowWithCategories = {
    medical_categories: { categories: unknown }[];
};

type MedicalRecordView<Row extends MedicalRecordRowWithCategories> = Omit<Row, "medical_categories"> & {
    categories: Row["medical_categories"][number]["categories"][];
};

export const toMedicalRecordView = <Row extends MedicalRecordRowWithCategories>(
    row: Row
): MedicalRecordView<Row> => {
    const { medical_categories, ...otherFields } = row;
    return {
        ...otherFields,
        // medical_categories の各要素は categories を 1 件ずつ持つため、取り出して並べるだけでよい。
        categories: medical_categories.map((medicalCategory) => medicalCategory.categories),
    };
};
