import { describe, test, expect } from "vitest";
import { prisma } from "@repo/db";
import { insertDoctor, NONEXISTENT_ID } from "../support/testRecords.js";

// setupFiles（test/support/pgliteDatabase.ts）が用意するテスト用 DB 自体の性質を確かめる。
// ここが崩れると、他の結合テストの結果は信用できなくなる。

describe("テスト用 DB", () => {
    test("マイグレーションが適用され、外部キー制約が効いている", async () => {
        await expect(
            prisma.medical_records.create({
                data: {
                    patient_id: NONEXISTENT_ID,
                    doctor_id: NONEXISTENT_ID,
                    medical_memo: "存在しない患者と医師を参照する",
                    doctor_memo: "",
                },
            })
        ).rejects.toMatchObject({ code: "P2003" });
    });

    // 次の 2 テストはファイル内で順に実行される前提で、前のテストのデータが後に残らないことを確かめる。
    test("データを書き込める", async () => {
        const doctor = await insertDoctor();

        expect(doctor.id).toBe(1);
    });

    test("前のテストのデータは残らず、採番も 1 から始まる", async () => {
        await expect(prisma.doctors.count()).resolves.toBe(0);

        const doctor = await insertDoctor();

        expect(doctor.id).toBe(1);
    });
});
