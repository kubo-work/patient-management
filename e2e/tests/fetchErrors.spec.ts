import { test, expect } from "../support/fixtures.ts";
import { DOCTOR_PAGES } from "../support/doctorPages.ts";
import { logInAsSeededDoctor } from "../support/login.ts";
import { SEEDED_PATIENT } from "../support/testDatabase.ts";
import { failTrpcQuery, returnToTab } from "../support/trpcFailure.ts";

const FETCH_FAILED_MESSAGE = "データの取得に失敗しました。";
const NOT_FOUND_MESSAGE = "データが見つかりません";

const PATIENT_BY_ID_PROCEDURE = "doctor.patients.byId";

test.describe("取得に失敗したときの表示", () => {
    test("患者一覧の取得に失敗すると、エラーが表示される", async ({ page }) => {
        await failTrpcQuery(page, "doctor.patients.page");
        await logInAsSeededDoctor(page);

        await expect(page.getByText(FETCH_FAILED_MESSAGE, { exact: true })).toBeVisible();
    });

    test("存在しない患者の編集画面を開くと、データが無いことが表示される", async ({ page }) => {
        const missingPatientId = 999999;
        await logInAsSeededDoctor(page);

        await page.goto(`${DOCTOR_PAGES.NEW_PATIENT}/${missingPatientId}`);

        await expect(page.getByText(NOT_FOUND_MESSAGE, { exact: true })).toBeVisible();
    });
});

// 画面を表示した後の取り直し（タブへ戻ったときなど）が失敗しても、入力中の内容を失わないこと。
test.describe("入力中に再取得が失敗したとき", () => {
    test("患者の編集フォームに入力した内容は消えない", async ({ page }) => {
        const typedPatientName = "入力中の名前";
        await logInAsSeededDoctor(page);
        await page
            .getByRole("row", { name: SEEDED_PATIENT.name })
            .getByRole("link", { name: "患者情報" })
            .click();
        const nameInput = page.getByLabel("名前");
        await expect(nameInput).toHaveValue(SEEDED_PATIENT.name);
        await nameInput.fill(typedPatientName);

        await failTrpcQuery(page, PATIENT_BY_ID_PROCEDURE);
        await returnToTab(page);

        await expect(nameInput).toHaveValue(typedPatientName);
        await expect(page.getByText(FETCH_FAILED_MESSAGE, { exact: true })).toHaveCount(0);
    });

    test("診察フォームに入力した内容は消えない", async ({ page }) => {
        const typedMemo = "入力中のメモ";
        await logInAsSeededDoctor(page);
        await page
            .getByRole("row", { name: SEEDED_PATIENT.name })
            .getByRole("link", { name: "診察履歴" })
            .click();
        await page.getByRole("button", { name: "新しい診察を作成" }).click();
        const dialog = page.getByRole("dialog", { name: "新しい診察を作成" });
        const memoInput = dialog.getByLabel("メモ", { exact: true });
        await memoInput.fill(typedMemo);

        await failTrpcQuery(page, PATIENT_BY_ID_PROCEDURE);
        await returnToTab(page);

        await expect(memoInput).toHaveValue(typedMemo);
        await expect(page.getByRole("heading", { name: `${SEEDED_PATIENT.name} 様` })).toBeVisible();
    });
});
