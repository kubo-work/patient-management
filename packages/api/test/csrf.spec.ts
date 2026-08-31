import { describe, test, expect } from "vitest";
import { app } from "../src/app.js";

// Express の express.json() が Content-Type を検査していたことが事実上の CSRF 障壁に
// なっていた。Hono ではその障壁が無いため、退行していないことをテストで固定する。
//
// 検証対象は /trpc/doctor.patients.create。app.ts のミドルウェア順序は
// cors → csrf → trpcServer であり、csrf は tRPC のリクエストにも先に効く。
// REST ルートは全て撤去済みで、検証対象は tRPC のパスのみである。
describe("CSRF 防御", () => {
    test("Origin の無い text/plain の POST は 403 で拒否される", async () => {
        const response = await app.request("/trpc/doctor.patients.create", {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: JSON.stringify({ name: "攻撃者" }),
        });
        expect(response.status).toBe(403);
    });

    test("許可されていない Origin からの text/plain の POST は 403 で拒否される", async () => {
        const response = await app.request("/trpc/doctor.patients.create", {
            method: "POST",
            headers: { "content-type": "text/plain", origin: "https://attacker.example" },
            body: JSON.stringify({ name: "攻撃者" }),
        });
        expect(response.status).toBe(403);
    });

    test("application/json の POST は csrf で拒否されない", async () => {
        // 認可が無いため 401 になるのが正しい。403（csrf による拒否）にならないことを確認する。
        const response = await app.request("/trpc/doctor.patients.create", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
        });
        expect(response.status).toBe(401);
    });
});
