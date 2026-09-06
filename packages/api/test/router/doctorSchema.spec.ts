import { describe, test, expect } from "vitest";
import { getDoctorSchema } from "../../src/router/doctors.js";

// ADR 0005 決定 6。repository の select と router の出力スキーマの両方で
// パスワードを落とす二重防御のうち、後者を検証する。
//
// レスポンス全体の形の回帰テストは実 DB が要るため #288（PGlite）に委ねている。
// ここで守れるのは「出力スキーマに password を足し戻す」退行だけである。
describe("getDoctorSchema", () => {
    test("password を持つ行を parse すると password が落ちる", () => {
        const parsed = getDoctorSchema.parse({
            id: 1,
            name: "医師",
            email: "doctor@example.com",
            password: "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaA",
        });
        expect(parsed).not.toHaveProperty("password");
        expect(parsed).toEqual({ id: 1, name: "医師", email: "doctor@example.com" });
    });
});
