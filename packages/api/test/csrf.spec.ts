import { describe, test, expect } from "vitest";
import { app } from "../src/app.js";

// Express の express.json() が Content-Type を検査していたことが事実上の CSRF 障壁に
// なっていた。Hono ではその障壁が無いため、退行していないことをテストで固定する。
describe("CSRF 防御", () => {
    test("Origin の無い text/plain の POST は 403 で拒否される", async () => {
        const response = await app.request("/doctor/medical_records", {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: JSON.stringify({ name: "攻撃者" }),
        });
        expect(response.status).toBe(403);
    });

    test("許可されていない Origin からの text/plain の POST は 403 で拒否される", async () => {
        const response = await app.request("/doctor/medical_records", {
            method: "POST",
            headers: { "content-type": "text/plain", origin: "https://attacker.example" },
            body: JSON.stringify({ name: "攻撃者" }),
        });
        expect(response.status).toBe(403);
    });

    test("application/json の POST は csrf で拒否されない", async () => {
        // 認可が無いため 401 になるのが正しい。403（csrf による拒否）にならないことを確認する。
        const response = await app.request("/doctor/medical_records", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
        });
        expect(response.status).toBe(401);
    });
});
