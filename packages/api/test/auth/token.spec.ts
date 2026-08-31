import { describe, test, expect } from "vitest";
import jwt from "jsonwebtoken";
import { secretKey } from "../../src/jwt_secret_key.js";
import { verifyDoctorToken, signDoctorToken } from "../../src/auth/token.js";

const { sign } = jwt;
const validDoctorId = 1234;

describe("verifyDoctorToken", () => {
    test("有効なトークンなら doctorId を返す", () => {
        const token = signDoctorToken(validDoctorId, "doctor@example.com");
        expect(token).not.toBeNull();
        expect(verifyDoctorToken(token as string)).toEqual({ ok: true, doctorId: validDoctorId });
    });

    test("署名が不正なら reason: invalid を返す", () => {
        const tamperedToken = sign({ userId: validDoctorId }, "wrong-secret-key", { expiresIn: "1d" });
        expect(verifyDoctorToken(tamperedToken)).toEqual({ ok: false, reason: "invalid" });
    });

    test("期限切れなら reason: invalid を返す", () => {
        const expiredToken = secretKey
            ? sign({ userId: validDoctorId }, secretKey, { expiresIn: "-1s" })
            : "";
        expect(verifyDoctorToken(expiredToken)).toEqual({ ok: false, reason: "invalid" });
    });

    test("JWT として解釈できない文字列なら reason: invalid を返す", () => {
        expect(verifyDoctorToken("not-a-jwt")).toEqual({ ok: false, reason: "invalid" });
    });
});

describe("signDoctorToken", () => {
    test("発行したトークンは verifyDoctorToken を通る", () => {
        const token = signDoctorToken(validDoctorId, "doctor@example.com");
        expect(verifyDoctorToken(token as string)).toEqual({ ok: true, doctorId: validDoctorId });
    });
});
