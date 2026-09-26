import { test, expect } from "../support/fixtures.ts";
import { DOCTOR_PAGES } from "../support/doctorPages.ts";
import { logInAs, logInAsSeededDoctor } from "../support/login.ts";
import { SEEDED_DOCTOR } from "../support/testDatabase.ts";

test.describe("ログイン", () => {
    test("正しいメールアドレスとパスワードでログインすると、患者一覧へ進み医師名が表示される", async ({
        page,
    }) => {
        await logInAsSeededDoctor(page);

        await expect(page.getByText(`${SEEDED_DOCTOR.name} さん`)).toBeVisible();
    });

    test("パスワードが違うとエラーが表示され、ログイン画面に留まる", async ({ page }) => {
        await logInAs(page, { email: SEEDED_DOCTOR.email, password: "wrong-password" });

        // Next.js も画面遷移の読み上げ用に空の role="alert" を置くため、文言で絞り込む。
        await expect(
            page.getByRole("alert").filter({ hasText: "無効なメールアドレスまたはパスワードです。" })
        ).toBeVisible();
        await expect(page).toHaveURL(DOCTOR_PAGES.LOGIN);
    });
});

test.describe("未認証時のリダイレクト", () => {
    test("ログインせずに医師用の画面を開くと、ログイン画面へ戻される", async ({ page }) => {
        await page.goto(DOCTOR_PAGES.PATIENTS_LIST);

        await expect(page).toHaveURL(DOCTOR_PAGES.LOGIN);
    });

    test("ログイン済みでログイン画面を開くと、患者一覧へ進む", async ({ page }) => {
        await logInAsSeededDoctor(page);

        await page.goto(DOCTOR_PAGES.LOGIN);

        await expect(page).toHaveURL(DOCTOR_PAGES.PATIENTS_LIST);
    });
});

test.describe("ログアウト", () => {
    test("ログアウトするとログイン画面へ戻り、医師用の画面は再び開けなくなる", async ({ page }) => {
        await logInAsSeededDoctor(page);

        await page.getByRole("button", { name: "ログアウト" }).click();

        await expect(page).toHaveURL(DOCTOR_PAGES.LOGIN);
        await page.goto(DOCTOR_PAGES.PATIENTS_LIST);
        await expect(page).toHaveURL(DOCTOR_PAGES.LOGIN);
    });
});
