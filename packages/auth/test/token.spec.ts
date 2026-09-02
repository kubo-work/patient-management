import { describe, test, expect } from "vitest";
import { SignJWT } from "jose";
import { signDoctorToken, verifyDoctorToken } from "../src/token.js";
import { doctorTokenSecret } from "../src/secret.js";

const validDoctorId = 1234;
const validDoctorEmail = "doctor@example.com";

// 別の鍵で署名したトークンが弾かれることを確認するために使う。
const wrongSecret = new TextEncoder().encode("wrong-secret-key");

// setExpirationTime に "-1s" のような相対指定を渡すと解釈がライブラリ依存になるため、
// 過去の絶対時刻（UNIX 秒）を渡して期限切れを確実に作る。
const oneMinuteAgoInSeconds = Math.floor(Date.now() / 1000) - 60;

describe("verifyDoctorToken", () => {
    test("有効なトークンなら doctorId を返す", async () => {
        const token = await signDoctorToken(validDoctorId, validDoctorEmail);
        await expect(verifyDoctorToken(token)).resolves.toEqual({
            ok: true,
            doctorId: validDoctorId,
        });
    });

    test("別の鍵で署名されたトークンは ok: false を返す", async () => {
        const tamperedToken = await new SignJWT({ userId: validDoctorId })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1d")
            .sign(wrongSecret);
        await expect(verifyDoctorToken(tamperedToken)).resolves.toEqual({ ok: false });
    });

    test("期限切れのトークンは ok: false を返す", async () => {
        const expiredToken = await new SignJWT({ userId: validDoctorId })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime(oneMinuteAgoInSeconds)
            .sign(doctorTokenSecret);
        await expect(verifyDoctorToken(expiredToken)).resolves.toEqual({ ok: false });
    });

    test("JWT として解釈できない文字列は ok: false を返す", async () => {
        await expect(verifyDoctorToken("not-a-jwt")).resolves.toEqual({ ok: false });
    });

    // 移植前の実装は Number(payload.userId) を無検査で返しており、
    // userId が無いトークンでは doctorId が NaN のまま通過していた（ADR 0004 波及）。
    test("userId を持たないトークンは ok: false を返す", async () => {
        const tokenWithoutUserId = await new SignJWT({ email: validDoctorEmail })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1d")
            .sign(doctorTokenSecret);
        await expect(verifyDoctorToken(tokenWithoutUserId)).resolves.toEqual({ ok: false });
    });
});

describe("signDoctorToken", () => {
    test("発行したトークンは verifyDoctorToken を通る", async () => {
        const token = await signDoctorToken(validDoctorId, validDoctorEmail);
        await expect(verifyDoctorToken(token)).resolves.toEqual({
            ok: true,
            doctorId: validDoctorId,
        });
    });

    test("ペイロードのクレーム名は userId のまま保つ", async () => {
        // 発行済みトークンとの互換のためクレーム名を変えない（ADR 0004 決定 1）。
        // 署名部分を検証せずペイロードだけを覗いて確認する。
        const token = await signDoctorToken(validDoctorId, validDoctorEmail);
        const payloadSegment = token.split(".")[1] as string;
        const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
        expect(payload.userId).toBe(validDoctorId);
        expect(payload.email).toBe(validDoctorEmail);
    });
});
