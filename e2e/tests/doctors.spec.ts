import { test, expect } from "../support/fixtures.ts";
import { DOCTOR_PAGES } from "../support/doctorPages.ts";
import { expectSavedOnList } from "../support/listPage.ts";
import { logInAsSeededDoctor } from "../support/login.ts";
import { SEEDED_DOCTOR } from "../support/testDatabase.ts";

test("医師一覧から医師情報を開いて名前を変えると、一覧に変更後の名前が表示される", async ({ page }) => {
    const renamedDoctorName = "医師 一郎（改名）";
    await logInAsSeededDoctor(page);

    await page.getByRole("link", { name: "医者一覧" }).click();
    await expect(page).toHaveURL(DOCTOR_PAGES.DOCTORS_LIST);
    await page
        .getByRole("row", { name: SEEDED_DOCTOR.email })
        .getByRole("link", { name: "編集" })
        .click();
    // 一覧の表にも「名前」を含むラベル（並べ替え・絞り込み）があるため、画面の切り替わりを待ってから入力欄を探す。
    await expect(page.getByRole("heading", { name: "お医者さんを編集" })).toBeVisible();
    // 既存の値が読み込まれてから書き換える（読み込み前に入力すると上書きされる）。
    const nameInput = page.getByLabel("名前");
    await expect(nameInput).toHaveValue(SEEDED_DOCTOR.name);
    await nameInput.fill(renamedDoctorName);
    await page.getByRole("button", { name: "更新" }).click();

    await expectSavedOnList(page, {
        listPath: DOCTOR_PAGES.DOCTORS_LIST,
        result: "update",
        rowText: renamedDoctorName,
    });
});
