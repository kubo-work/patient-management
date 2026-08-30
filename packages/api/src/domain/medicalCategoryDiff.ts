// 診察履歴のカテゴリを更新する際、既存と指定を突き合わせて削除分と追加分を求める。
// 移植前は $transaction の中に手続きとして埋まっており、DB を用意しなければ
// 検証できなかった。I/O から切り離すことで mock なしでテストできる。
export type MedicalCategoryDiff = {
    categoryIdsToDelete: number[];
    categoryIdsToAdd: number[];
};

export const diffMedicalCategories = (
    existingCategoryIds: number[],
    desiredCategoryIds: number[]
): MedicalCategoryDiff => ({
    categoryIdsToDelete: existingCategoryIds.filter(
        (categoryId) => !desiredCategoryIds.includes(categoryId)
    ),
    categoryIdsToAdd: desiredCategoryIds.filter(
        (categoryId) => !existingCategoryIds.includes(categoryId)
    ),
});
