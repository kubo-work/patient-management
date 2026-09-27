import { describe, test, expect } from "vitest";
import { toMedicalRecordView } from "../../src/domain/medicalRecordView.js";

const baseRow = {
    id: 1,
    patient_id: 10,
    doctor_id: 20,
    examination_at: new Date("2026-03-01T09:00:00"),
    medical_memo: "所見",
    doctor_memo: "メモ",
};

describe("toMedicalRecordView", () => {
    test("medical_categories を categories へ平坦化する", () => {
        const view = toMedicalRecordView({
            ...baseRow,
            medical_categories: [
                { categories: { id: 3, treatment: "電気療法" } },
                { categories: { id: 4, treatment: "手技療法" } },
            ],
        });
        expect(view.categories).toEqual([
            { id: 3, treatment: "電気療法" },
            { id: 4, treatment: "手技療法" },
        ]);
    });

    test("カテゴリが空なら空配列になる", () => {
        expect(toMedicalRecordView({ ...baseRow, medical_categories: [] }).categories).toEqual([]);
    });

    test("カテゴリ以外の項目をそのまま引き継ぐ", () => {
        const view = toMedicalRecordView({ ...baseRow, medical_categories: [] });
        expect(view).toMatchObject(baseRow);
    });

    test("medical_categories というキーは結果に残らない", () => {
        const view = toMedicalRecordView({ ...baseRow, medical_categories: [] });
        expect(view).not.toHaveProperty("medical_categories");
    });
});
