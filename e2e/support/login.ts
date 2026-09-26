import { expect, type Page } from "@playwright/test";
import { DOCTOR_PAGES } from "./doctorPages.ts";
import { SEEDED_DOCTOR } from "./testDatabase.ts";

// ログイン画面で資格情報を入力して送信する。成功・失敗のどちらも検証できるよう、結果は待たない。
export const logInAs = async (
    page: Page,
    credentials: { email: string; password: string }
): Promise<void> => {
    await page.goto(DOCTOR_PAGES.LOGIN);
    await page.getByLabel("メールアドレス").fill(credentials.email);
    await page.getByLabel("パスワード").fill(credentials.password);
    await page.getByRole("button", { name: "ログイン" }).click();
};

// 初期データの医師でログインし、ログイン後の患者一覧に着くまで待つ。
// ログイン済みの状態から始めるテストの前提として使う。
export const logInAsSeededDoctor = async (page: Page): Promise<void> => {
    await logInAs(page, SEEDED_DOCTOR);
    await expect(page).toHaveURL(DOCTOR_PAGES.PATIENTS_LIST);
};
