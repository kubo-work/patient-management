import { describe, test, expect } from "vitest";
import { diffMedicalCategories } from "../../src/domain/medicalCategoryDiff.js";

describe("diffMedicalCategories", () => {
    test("追加も削除も無い場合は両方空になる", () => {
        expect(diffMedicalCategories([1, 2, 3], [1, 2, 3])).toEqual({
            categoryIdsToDelete: [],
            categoryIdsToAdd: [],
        });
    });

    test("指定に無い既存カテゴリは削除対象になる", () => {
        expect(diffMedicalCategories([1, 2, 3], [1, 3])).toEqual({
            categoryIdsToDelete: [2],
            categoryIdsToAdd: [],
        });
    });

    test("既存に無い指定カテゴリは追加対象になる", () => {
        expect(diffMedicalCategories([1], [1, 5])).toEqual({
            categoryIdsToDelete: [],
            categoryIdsToAdd: [5],
        });
    });

    test("追加と削除が同時に起きる", () => {
        expect(diffMedicalCategories([1, 2], [2, 9])).toEqual({
            categoryIdsToDelete: [1],
            categoryIdsToAdd: [9],
        });
    });

    test("既存が空なら指定がすべて追加対象になる", () => {
        expect(diffMedicalCategories([], [4, 7])).toEqual({
            categoryIdsToDelete: [],
            categoryIdsToAdd: [4, 7],
        });
    });

    test("指定が空なら既存がすべて削除対象になる", () => {
        expect(diffMedicalCategories([3, 8], [])).toEqual({
            categoryIdsToDelete: [3, 8],
            categoryIdsToAdd: [],
        });
    });

    test("引数の配列を変更しない", () => {
        const existingCategoryIds = [1, 2];
        const desiredCategoryIds = [2, 3];
        diffMedicalCategories(existingCategoryIds, desiredCategoryIds);
        expect(existingCategoryIds).toEqual([1, 2]);
        expect(desiredCategoryIds).toEqual([2, 3]);
    });
});
