import { describe, test, expect } from "vitest";
import { hashPassword } from "@repo/auth/password";
import { verifyDoctorPassword } from "../../src/domain/doctorLogin.js";

const plainPassword = "doctor-password";

describe("verifyDoctorPassword", () => {
    test("保存されたハッシュと一致すれば true を返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        await expect(verifyDoctorPassword(storedPasswordHash, plainPassword)).resolves.toBe(true);
    });

    test("保存されたハッシュと一致しなければ false を返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        await expect(verifyDoctorPassword(storedPasswordHash, "wrong-password")).resolves.toBe(false);
    });

    // 医師が見つからない場合。呼び出し側は null を渡す。
    test("医師が見つからない場合は false を返す", async () => {
        await expect(verifyDoctorPassword(null, plainPassword)).resolves.toBe(false);
    });

    // ADR 0005 決定 5。存在しないメールアドレスが即座に失敗すると、応答時間で
    // アカウントの存在が判別できてしまう。医師が見つからない場合もダミーハッシュに
    // 対して検証を走らせることで時間を揃える。
    //
    // 時間そのものを閾値で検証するとマシンの負荷でぶれるため、「一致する場合と
    // 同じオーダーの時間がかかる」ことだけを緩く確認する。ダミーハッシュを
    // 不正な文字列に書き換える退行は、この検証で捕まる（即座に返るようになるため）。
    test("医師が見つからない場合も検証と同程度の時間がかかる", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);

        const startOfFoundCase = performance.now();
        await verifyDoctorPassword(storedPasswordHash, "wrong-password");
        const foundCaseDuration = performance.now() - startOfFoundCase;

        const startOfMissingCase = performance.now();
        await verifyDoctorPassword(null, "wrong-password");
        const missingCaseDuration = performance.now() - startOfMissingCase;

        // 見つからない場合が、見つかる場合の 4 分の 1 未満で返るなら
        // ダミー検証が走っていない。
        expect(missingCaseDuration).toBeGreaterThan(foundCaseDuration / 4);
    });
});
