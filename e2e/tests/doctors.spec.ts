import { test, expect } from "../support/fixtures.ts";
import { DOCTOR_PAGES } from "../support/doctorPages.ts";
import { logInAsSeededDoctor } from "../support/login.ts";
import { SEEDED_DOCTOR } from "../support/testDatabase.ts";

// 医師の編集フォームは、「メールアドレス」のラベルが名前の入力欄（htmlFor="name"）を指しており、
// ラベルから入力欄を引くと取り違える。そのため入力欄はプレースホルダで特定する。

test("医師一覧から医師情報を開いて名前を変えると、一覧に変更後の名前が表示される", async ({ page }) => {
    await logInAsSeededDoctor(page);

    await page.getByRole("link", { name: "医者一覧" }).click();
    await expect(page).toHaveURL(DOCTOR_PAGES.DOCTORS_LIST);
    await page
        .getByRole("row", { name: new RegExp(SEEDED_DOCTOR.email) })
        .getByRole("link", { name: "編集" })
        .click();
    // 既存の値が読み込まれてから書き換える（読み込み前に入力すると上書きされる）。
    const nameInput = page.getByPlaceholder("山田太郎");
    await expect(nameInput).toHaveValue(SEEDED_DOCTOR.name);
    await nameInput.fill("医師 一郎（改名）");
    await page.getByRole("button", { name: "更新" }).click();

    await expect(page).toHaveURL(new RegExp(`${DOCTOR_PAGES.DOCTORS_LIST}\\?success=update`));
    await expect(page.getByText("更新しました。", { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: /医師 一郎（改名）/ })).toBeVisible();
});
