import { describe, test, expect } from "vitest";
import { createDoctorClient } from "../support/trpcTestClient.js";
import { insertCategory, insertDoctor } from "../support/testRecords.js";

describe("doctor.categories.list", () => {
    test("親カテゴリだけを、子カテゴリを持たせた形で返す", async () => {
        const internalMedicine = await insertCategory("内科");
        const cold = await insertCategory("風邪", internalMedicine.id);
        const surgery = await insertCategory("外科");
        const client = await createDoctorClient(await insertDoctor());

        await expect(client.doctor.categories.list.query()).resolves.toEqual([
            {
                id: internalMedicine.id,
                treatment: "内科",
                children: [{ id: cold.id, treatment: "風邪" }],
            },
            { id: surgery.id, treatment: "外科", children: [] },
        ]);
    });
});
