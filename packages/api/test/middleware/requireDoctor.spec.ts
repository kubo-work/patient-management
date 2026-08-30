import { describe, test, expect } from "vitest";
import { Hono } from "hono";
import jwt from "jsonwebtoken";
import { doctorCookieName } from "@repo/schema";
import { secretKey } from "../../src/jwt_secret_key.js";
import { requireDoctor, type DoctorAuthVariables } from "../../src/middleware/requireDoctor.js";

const { sign } = jwt;

// ミドルウェア単体を検証するため、doctorId をそのまま返すだけの最小のアプリを組む。
const testApp = new Hono<{ Variables: DoctorAuthVariables }>().get(
    "/protected",
    requireDoctor,
    (context) => context.json({ doctorId: context.get("doctorId") })
);

const validDoctorId = 1234;
const validToken = secretKey
    ? sign({ userId: validDoctorId, email: "doctor@example.com" }, secretKey, { expiresIn: "1d" })
    : "";

describe("requireDoctor", () => {
    test("有効なトークンなら doctorId を Context にセットして次へ進む", async () => {
        const response = await testApp.request("/protected", {
            headers: { cookie: `${doctorCookieName}=${validToken}` },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ doctorId: validDoctorId });
    });

    test("Cookie が無ければ 401 を返す", async () => {
        const response = await testApp.request("/protected");
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "ログインしてください。" });
    });

    test("Cookie が空文字なら 401 を返す", async () => {
        const response = await testApp.request("/protected", {
            headers: { cookie: `${doctorCookieName}=` },
        });
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "ログインしてください。" });
    });

    test("署名が不正なトークンなら 403 を返す", async () => {
        const tamperedToken = sign({ userId: validDoctorId }, "wrong-secret-key", {
            expiresIn: "1d",
        });
        const response = await testApp.request("/protected", {
            headers: { cookie: `${doctorCookieName}=${tamperedToken}` },
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
            error: "ログインの有効期限が切れている可能性があります。",
        });
    });

    test("期限切れのトークンなら 403 を返す", async () => {
        const expiredToken = secretKey
            ? sign({ userId: validDoctorId }, secretKey, { expiresIn: "-1s" })
            : "";
        const response = await testApp.request("/protected", {
            headers: { cookie: `${doctorCookieName}=${expiredToken}` },
        });
        expect(response.status).toBe(403);
    });
});
