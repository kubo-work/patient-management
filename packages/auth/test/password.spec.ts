import { describe, test, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/password.js";

const plainPassword = "correct-horse-battery-staple";

describe("hashPassword", () => {
    test("PHC 形式の argon2id ハッシュを返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        expect(storedPasswordHash.startsWith("$argon2id$")).toBe(true);
    });

    test("OWASP 推奨のパラメータがハッシュに埋め込まれている", async () => {
        // PHC 形式はパラメータを自己記述する。ここが変わると既存ハッシュとの
        // 互換や強度が変わるため、値そのものを検証する。
        const storedPasswordHash = await hashPassword(plainPassword);
        expect(storedPasswordHash).toContain("m=19456,t=2,p=1");
    });

    test("同じパスワードでも毎回異なるハッシュになる", async () => {
        // ソルトが毎回生成されることの確認。同一になるならソルトが無い。
        const first = await hashPassword(plainPassword);
        const second = await hashPassword(plainPassword);
        expect(first).not.toBe(second);
    });
});

describe("verifyPassword", () => {
    test("正しいパスワードなら true を返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        await expect(verifyPassword(storedPasswordHash, plainPassword)).resolves.toBe(true);
    });

    test("誤ったパスワードなら false を返す", async () => {
        const storedPasswordHash = await hashPassword(plainPassword);
        await expect(verifyPassword(storedPasswordHash, "wrong-password")).resolves.toBe(false);
    });

    // ADR 0005 決定 2。lazy migration をしないため、移行漏れの平文が残っていても
    // ログインさせない。argon2 の verify は PHC 形式でない入力に例外を投げるので、
    // それを握って false にする。ここが throw すると 500 になり fail-open と
    // 区別がつかなくなる。
    test("平文が保存されている行は例外ではなく false を返す", async () => {
        await expect(verifyPassword("plaintext-password", "plaintext-password")).resolves.toBe(false);
    });

    test("空文字が保存されている行も false を返す", async () => {
        await expect(verifyPassword("", plainPassword)).resolves.toBe(false);
    });
});
