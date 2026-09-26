import type { Page } from "@playwright/test";
import { test, expect } from "../support/fixtures.ts";
import { SEEDED_DOCTOR } from "../support/testDatabase.ts";

const logInAs = async (page: Page, credentials: { email: string; password: string }) => {
    await page.goto("/doctor/login");
    await page.getByLabel("メールアドレス").fill(credentials.email);
    await page.getByLabel("パスワード").fill(credentials.password);
    await page.getByRole("button", { name: "ログイン" }).click();
};

test.describe("ログイン", () => {
    test("正しいメールアドレスとパスワードでログインすると、患者一覧へ進み医師名が表示される", async ({
        page,
    }) => {
        await logInAs(page, SEEDED_DOCTOR);

        await expect(page).toHaveURL("/doctor/patients-list");
        await expect(page.getByText(`${SEEDED_DOCTOR.name} さん`)).toBeVisible();
    });

    test("パスワードが違うとエラーが表示され、ログイン画面に留まる", async ({ page }) => {
        await logInAs(page, { email: SEEDED_DOCTOR.email, password: "wrong-password" });

        // Next.js も画面遷移の読み上げ用に空の role="alert" を置くため、文言で絞り込む。
        await expect(
            page.getByRole("alert").filter({ hasText: "無効なメールアドレスまたはパスワードです。" })
        ).toBeVisible();
        await expect(page).toHaveURL("/doctor/login");
    });
});

test.describe("未認証時のリダイレクト", () => {
    test("ログインせずに医師用の画面を開くと、ログイン画面へ戻される", async ({ page }) => {
        await page.goto("/doctor/patients-list");

        await expect(page).toHaveURL("/doctor/login");
    });

    test("ログイン済みでログイン画面を開くと、患者一覧へ進む", async ({ page }) => {
        await logInAs(page, SEEDED_DOCTOR);
        await expect(page).toHaveURL("/doctor/patients-list");

        await page.goto("/doctor/login");

        await expect(page).toHaveURL("/doctor/patients-list");
    });
});

test.describe("ログアウト", () => {
    test("ログアウトするとログイン画面へ戻り、医師用の画面は再び開けなくなる", async ({ page }) => {
        await logInAs(page, SEEDED_DOCTOR);
        await expect(page).toHaveURL("/doctor/patients-list");

        await page.getByRole("button", { name: "ログアウト" }).click();

        await expect(page).toHaveURL("/doctor/login");
        await page.goto("/doctor/patients-list");
        await expect(page).toHaveURL("/doctor/login");
    });
});
