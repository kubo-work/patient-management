import { describe, test, expect } from "vitest";
import { derivePatientInitialPassword } from "../../src/domain/patientPassword.js";

describe("derivePatientInitialPassword", () => {
    test("Date から YYYYMMDD の 8 桁を作る", () => {
        expect(derivePatientInitialPassword(new Date("1990-04-05T00:00:00"))).toBe("19900405");
    });

    test("1 桁の月日をゼロ埋めする", () => {
        expect(derivePatientInitialPassword(new Date("2001-01-02T00:00:00"))).toBe("20010102");
    });

    test("ISO 文字列でも同じ結果になる", () => {
        expect(derivePatientInitialPassword("1990-04-05T00:00:00")).toBe("19900405");
    });

    test("常に 8 文字を返す", () => {
        expect(derivePatientInitialPassword(new Date("2024-12-31T00:00:00"))).toHaveLength(8);
    });
});
