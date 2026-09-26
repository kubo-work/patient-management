import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../support/fixtures.ts";
import { logInAsSeededDoctor } from "../support/login.ts";
import { SEEDED_CATEGORIES, SEEDED_PATIENT } from "../support/testDatabase.ts";

const [COLD, HEADACHE] = SEEDED_CATEGORIES.CHILDREN;

// カテゴリの複数選択欄（親カテゴリ名がラベル）を開き、指定した子カテゴリを順に押す。
// Mantine の MultiSelect は、未選択の選択肢を押すと選択し、選択済みの選択肢を押すと選択を外す。
// 選択肢を押してもドロップダウンは開いたままで、ラベルをもう一度押すと閉じてしまうため、開くのは 1 回だけにする。
const toggleCategories = async (
    dialog: Locator,
    childTreatments: readonly string[]
): Promise<void> => {
    await dialog.getByLabel(SEEDED_CATEGORIES.PARENT).click();
    for (const childTreatment of childTreatments) {
        await dialog.page().getByRole("option", { name: childTreatment }).click();
    }
};

const openMedicalRecordsOfSeededPatient = async (page: Page): Promise<void> => {
    await page
        .getByRole("row", { name: new RegExp(SEEDED_PATIENT.name) })
        .getByRole("link", { name: "診察履歴" })
        .click();
    await expect(page.getByRole("heading", { name: `${SEEDED_PATIENT.name} 様` })).toBeVisible();
};

test("診察履歴から診察を作成し、編集して、削除できる", async ({ page }) => {
    await logInAsSeededDoctor(page);
    await openMedicalRecordsOfSeededPatient(page);

    await test.step("新しい診察を作成する", async () => {
        await page.getByRole("button", { name: "新しい診察を作成" }).click();
        const dialog = page.getByRole("dialog", { name: "新しい診察を作成" });
        await toggleCategories(dialog, [COLD]);
        await dialog.getByLabel("メモ", { exact: true }).fill("咳が続く");
        await dialog.getByRole("button", { name: "保存" }).click();

        await expect(dialog).toBeHidden();
        await expect(page.getByText("診察を保存しました。", { exact: true })).toBeVisible();
        await expect(page.getByRole("row", { name: new RegExp(COLD) })).toBeVisible();
    });

    await test.step("診察のカテゴリを入れ替えて更新する", async () => {
        await page.getByRole("row", { name: new RegExp(COLD) }).getByRole("button", { name: "編集" }).click();
        const dialog = page.getByRole("dialog", { name: "診察編集" });
        await toggleCategories(dialog, [COLD, HEADACHE]);
        await dialog.getByLabel("メモ", { exact: true }).fill("頭痛もある");
        await dialog.getByRole("button", { name: "更新" }).click();

        await expect(dialog).toBeHidden();
        await expect(page.getByText("診察を更新しました。", { exact: true })).toBeVisible();
        await expect(page.getByRole("row", { name: new RegExp(HEADACHE) })).toBeVisible();
        await expect(page.getByRole("row", { name: new RegExp(COLD) })).toHaveCount(0);
    });

    await test.step("診察を削除する", async () => {
        await page.getByRole("row", { name: new RegExp(HEADACHE) }).getByRole("button", { name: "編集" }).click();
        const dialog = page.getByRole("dialog", { name: "診察編集" });
        // 削除は window.confirm で確認する。Playwright は既定で確認ダイアログを閉じる（= キャンセル）ため、
        // この操作に限って OK を押す。
        page.once("dialog", (confirmDialog) => confirmDialog.accept());
        await dialog.getByRole("button", { name: "削除" }).click();

        await expect(dialog).toBeHidden();
        await expect(page.getByText("診察を削除しました。", { exact: true })).toBeVisible();
        await expect(page.getByRole("row", { name: new RegExp(HEADACHE) })).toHaveCount(0);
    });
});
