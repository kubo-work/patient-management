import { describe, test, expect } from "vitest";
import { doctorCookieName } from "@repo/schema";
import {
    createSetCookieCapturingClient,
    createTestClient,
    LOGIN_SUCCEEDED_RESPONSE,
} from "../support/trpcTestClient.js";
import { insertDoctor } from "../support/testRecords.js";

describe("doctor.login", () => {
    test("正しいメールアドレスとパスワードで Cookie が発行され、その Cookie で認可を通過できる", async () => {
        const doctor = await insertDoctor({
            email: "login@example.com",
            plainPassword: "correct-password",
        });
        const { client, readLastSetCookieHeader } = createSetCookieCapturingClient();

        await expect(
            client.doctor.login.mutate({ email: "login@example.com", password: "correct-password" })
        ).resolves.toEqual(LOGIN_SUCCEEDED_RESPONSE);

        const setCookieHeader = readLastSetCookieHeader();
        if (setCookieHeader === null) {
            throw new Error("ログインのレスポンスで Set-Cookie が発行されていない");
        }
        expect(setCookieHeader).toMatch(new RegExp(`^${doctorCookieName}=[^;]+;`));
        expect(setCookieHeader).toContain("HttpOnly");

        // ブラウザと同じく、Set-Cookie の名前と値だけを次のリクエストの Cookie に載せる。
        const [issuedCookie] = setCookieHeader.split(";");
        const loggedInClient = createTestClient({ cookieHeader: issuedCookie });
        await expect(loggedInClient.doctor.loginDoctor.query()).resolves.toEqual({
            id: doctor.id,
            name: doctor.name,
            email: "login@example.com",
        });
    });

    test("パスワードが違うと UNAUTHORIZED になる", async () => {
        await insertDoctor({ email: "login@example.com", plainPassword: "correct-password" });

        await expect(
            createTestClient().doctor.login.mutate({
                email: "login@example.com",
                password: "wrong-password",
            })
        ).rejects.toMatchObject({
            data: { code: "UNAUTHORIZED" },
            message: "無効なメールアドレスまたはパスワードです。",
        });
    });

    test("存在しないメールアドレスでも、パスワード違いと同じ UNAUTHORIZED になる", async () => {
        await expect(
            createTestClient().doctor.login.mutate({
                email: "nobody@example.com",
                password: "correct-password",
            })
        ).rejects.toMatchObject({
            data: { code: "UNAUTHORIZED" },
            message: "無効なメールアドレスまたはパスワードです。",
        });
    });
});
