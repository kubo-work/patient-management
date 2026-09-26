import { test, expect } from "../support/fixtures.ts";
import { DOCTOR_PAGES } from "../support/doctorPages.ts";
import { expectSavedOnList } from "../support/listPage.ts";
import { logInAsSeededDoctor } from "../support/login.ts";
import { SEEDED_PATIENT } from "../support/testDatabase.ts";

test.describe("患者の登録", () => {
    test("患者一覧から新しい患者を登録すると、一覧に戻って登録した患者が表示される", async ({
        page,
    }) => {
        const newPatientName = "患者 太郎";
        await logInAsSeededDoctor(page);

        await page.getByRole("link", { name: "新しい患者さんを登録" }).click();
        await expect(page).toHaveURL(DOCTOR_PAGES.NEW_PATIENT);
        // 一覧の表にも「名前」を含むラベル（並べ替え・絞り込み）があるため、画面の切り替わりを待ってから入力欄を探す。
        await expect(page.getByRole("heading", { name: "新しい患者さんを登録" })).toBeVisible();
        await page.getByLabel("名前").fill(newPatientName);
        await page.getByLabel("電話番号").fill("080-1111-2222");
        await page.getByLabel("住所").fill("大阪府");
        await page.getByLabel("メールアドレス").fill("new-patient@example.com");
        await page.getByRole("button", { name: "保存" }).click();

        await expectSavedOnList(page, {
            listPath: DOCTOR_PAGES.PATIENTS_LIST,
            result: "new",
            rowText: newPatientName,
        });
    });
});

test.describe("患者情報の編集", () => {
    test("患者一覧から患者情報を開いて名前を変えると、一覧に変更後の名前が表示される", async ({
        page,
    }) => {
        const renamedPatientName = "患者 花子（改姓）";
        await logInAsSeededDoctor(page);

        await page
            .getByRole("row", { name: SEEDED_PATIENT.name })
            .getByRole("link", { name: "患者情報" })
            .click();
        // 一覧の表にも「名前」を含むラベル（並べ替え・絞り込み）があるため、画面の切り替わりを待ってから入力欄を探す。
        await expect(page.getByRole("heading", { name: "患者情報を編集" })).toBeVisible();
        // 既存の値が読み込まれてから書き換える（読み込み前に入力すると上書きされる）。
        const nameInput = page.getByLabel("名前");
        await expect(nameInput).toHaveValue(SEEDED_PATIENT.name);
        await nameInput.fill(renamedPatientName);
        await page.getByRole("button", { name: "更新" }).click();

        await expectSavedOnList(page, {
            listPath: DOCTOR_PAGES.PATIENTS_LIST,
            result: "update",
            rowText: renamedPatientName,
        });
    });
});
