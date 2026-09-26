import { describe, test, expect } from "vitest";
import { createDoctorClient } from "../support/trpcTestClient.js";
import { insertCategory, insertDoctor } from "../support/testRecords.js";

describe("doctor.categories.list", () => {
    test("親カテゴリだけを、子カテゴリを持たせた形で返す", async () => {
        const insuranceTreatment = await insertCategory("保険適用施術");
        const electricTherapy = await insertCategory("電気療法", insuranceTreatment.id);
        const selfPaidTreatment = await insertCategory("自費施術メニュー");
        const client = await createDoctorClient(await insertDoctor());

        await expect(client.doctor.categories.list.query()).resolves.toEqual([
            {
                id: insuranceTreatment.id,
                treatment: "保険適用施術",
                children: [{ id: electricTherapy.id, treatment: "電気療法" }],
            },
            { id: selfPaidTreatment.id, treatment: "自費施術メニュー", children: [] },
        ]);
    });
});
