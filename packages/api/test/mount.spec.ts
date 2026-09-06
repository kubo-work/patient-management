import { describe, test, expect } from "vitest";
import { app } from "../src/app.js";

// ADR 0006 決定 4。単独起動時は /trpc/* で、Vercel の route handler 経由では
// /api/trpc/* でリクエストが届く。hono/vercel の handle はパスの前置きを
// 剥がさないため、どちらでも同じ結果になることをここで固定する。
//
// 認可が無いので 401 が返るのが正しい。404 が返る場合はマウントされていない。
describe("マウントされるパス", () => {
    test("/trpc/* は認可が無ければ 401 を返す", async () => {
        const response = await app.request("/trpc/doctor.categories.list");
        expect(response.status).toBe(401);
    });

    test("/api/trpc/* も認可が無ければ 401 を返す", async () => {
        const response = await app.request("/api/trpc/doctor.categories.list");
        expect(response.status).toBe(401);
    });

    test("どちらにもマウントされていないパスは 404 を返す", async () => {
        const response = await app.request("/nonexistent");
        expect(response.status).toBe(404);
    });
});
