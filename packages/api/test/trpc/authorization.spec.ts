import { describe, test, expect } from "vitest";
import { app } from "../../src/app.js";

// 認可が必要な procedure を Cookie 無しで叩き、弾かれることを確認する。
// 旧 REST の spec を削除したことで失われた回帰検知を、DB 非依存の形で埋め直すもの。
// procedure を追加するタスクは、この一覧に行を足すこと。
const protectedQueryPaths = [
    "/trpc/doctor.categories.list",
    "/trpc/doctor.doctors.list",
    "/trpc/doctor.doctors.byId",
    "/trpc/doctor.loginDoctor",
    "/trpc/doctor.patients.list",
    "/trpc/doctor.patients.byId",
    "/trpc/doctor.medicalRecords.byPatient",
];

describe("認可が必要な query は Cookie 無しで 401 を返す", () => {
    test.each(protectedQueryPaths)("%s", async (path) => {
        const response = await app.request(path);
        expect(response.status).toBe(401);
        expect(JSON.stringify(await response.json())).toContain("ログインしてください。");
    });
});

describe("認可が必要な mutation は Cookie 無しで 401 を返す", () => {
    // #284 で塞いだ認可の穴（ADR 0002 決定 7）の回帰を検知する。
    // protectedProcedure を publicProcedure に戻すとここが落ちる。
    test("doctor.doctors.update", async () => {
        const response = await app.request("/trpc/doctor.doctors.update", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ doctorId: 1, name: "x", email: "x@example.com", password: "x" }),
        });
        expect(response.status).toBe(401);
        expect(JSON.stringify(await response.json())).toContain("ログインしてください。");
    });

    test("doctor.doctors.create", async () => {
        const response = await app.request("/trpc/doctor.doctors.create", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "x", email: "x@example.com", password: "x" }),
        });
        expect(response.status).toBe(401);
        expect(JSON.stringify(await response.json())).toContain("ログインしてください。");
    });

    test("doctor.patients.update", async () => {
        const response = await app.request("/trpc/doctor.patients.update", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                id: 1,
                name: "x",
                email: "x@example.com",
                tel: "000-0000-0000",
                sex: "no_answer",
                address: "x",
                birth: "1990-04-05T00:00:00.000Z",
            }),
        });
        expect(response.status).toBe(401);
        expect(JSON.stringify(await response.json())).toContain("ログインしてください。");
    });

    test("doctor.patients.create", async () => {
        const response = await app.request("/trpc/doctor.patients.create", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                name: "x",
                email: "x@example.com",
                tel: "000-0000-0000",
                sex: "no_answer",
                address: "x",
                birth: "1990-04-05T00:00:00.000Z",
            }),
        });
        expect(response.status).toBe(401);
        expect(JSON.stringify(await response.json())).toContain("ログインしてください。");
    });

    test("doctor.medicalRecords.update", async () => {
        const response = await app.request("/trpc/doctor.medicalRecords.update", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                id: 1,
                patient_id: 1,
                doctor_id: 1,
                examination_at: "2026-03-01T09:00:00.000Z",
                medical_memo: "x",
                doctor_memo: "x",
                categories: ["1"],
            }),
        });
        expect(response.status).toBe(401);
        expect(JSON.stringify(await response.json())).toContain("ログインしてください。");
    });

    test("doctor.medicalRecords.create", async () => {
        const response = await app.request("/trpc/doctor.medicalRecords.create", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                patient_id: 1,
                doctor_id: 1,
                examination_at: "2026-03-01T09:00:00.000Z",
                medical_memo: "x",
                doctor_memo: "x",
                categories: ["1"],
            }),
        });
        expect(response.status).toBe(401);
        expect(JSON.stringify(await response.json())).toContain("ログインしてください。");
    });

    test("doctor.medicalRecords.remove", async () => {
        const response = await app.request("/trpc/doctor.medicalRecords.remove", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: 1 }),
        });
        expect(response.status).toBe(401);
        expect(JSON.stringify(await response.json())).toContain("ログインしてください。");
    });
});
