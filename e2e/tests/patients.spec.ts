import { test, expect } from "../support/fixtures.ts";
import { DOCTOR_PAGES } from "../support/doctorPages.ts";
import { logInAsSeededDoctor } from "../support/login.ts";
import { SEEDED_PATIENT } from "../support/testDatabase.ts";

// 患者の登録・編集フォームは、「メールアドレス」のラベルと入力欄の id が一致しておらず
// ラベルから入力欄を引けない。そのため入力欄はプレースホルダで特定する。

test.describe("患者の登録", () => {
    test("患者一覧から新しい患者を登録すると、一覧に戻って登録した患者が表示される", async ({
        page,
    }) => {
        await logInAsSeededDoctor(page);

        await page.getByRole("link", { name: "新しい患者さんを登録" }).click();
        await expect(page).toHaveURL(DOCTOR_PAGES.NEW_PATIENT);
        await page.getByPlaceholder("山田太郎").fill("患者 太郎");
        await page.getByPlaceholder("0000-11-2222").fill("080-1111-2222");
        await page.getByPlaceholder("⚪︎⚪︎県⚪︎⚪︎市⚪︎⚪︎番地").fill("大阪府");
        await page.getByPlaceholder("**@example.com").fill("new-patient@example.com");
        await page.getByRole("button", { name: "保存" }).click();

        await expect(page).toHaveURL(new RegExp(`${DOCTOR_PAGES.PATIENTS_LIST}\\?success=new`));
        await expect(page.getByText("保存しました。", { exact: true })).toBeVisible();
        await expect(page.getByRole("row", { name: /患者 太郎/ })).toBeVisible();
    });
});

test.describe("患者情報の編集", () => {
    test("患者一覧から患者情報を開いて名前を変えると、一覧に変更後の名前が表示される", async ({
        page,
    }) => {
        await logInAsSeededDoctor(page);

        await page
            .getByRole("row", { name: new RegExp(SEEDED_PATIENT.name) })
            .getByRole("link", { name: "患者情報" })
            .click();
        // 既存の値が読み込まれてから書き換える（読み込み前に入力すると上書きされる）。
        const nameInput = page.getByPlaceholder("山田太郎");
        await expect(nameInput).toHaveValue(SEEDED_PATIENT.name);
        await nameInput.fill("患者 花子（改姓）");
        await page.getByRole("button", { name: "更新" }).click();

        await expect(page).toHaveURL(new RegExp(`${DOCTOR_PAGES.PATIENTS_LIST}\\?success=update`));
        await expect(page.getByText("更新しました。", { exact: true })).toBeVisible();
        await expect(page.getByRole("row", { name: /患者 花子（改姓）/ })).toBeVisible();
    });
});
