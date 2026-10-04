import { test, expect } from "../support/fixtures.ts";
import { DOCTOR_PAGES } from "../support/doctorPages.ts";
import { expectSavedOnList } from "../support/listPage.ts";
import { logInAsSeededDoctor } from "../support/login.ts";
import { insertPatient, renamePatient, SEEDED_PATIENT } from "../support/testDatabase.ts";

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

// 診察履歴の画面も同じ患者を取得するため、その結果がキャッシュに残っている。
// 編集フォームがキャッシュの値を初期値にすると、保存したときに他の医師の更新を古い値で上書きしてしまう。
test("診察履歴を開いた後に他で名前が変わっても、編集フォームには取得し直した名前が入る", async ({ page }) => {
    const renamedPatientName = "患者 花子（他の医師が改姓）";
    await logInAsSeededDoctor(page);
    await page
        .getByRole("row", { name: SEEDED_PATIENT.name })
        .getByRole("link", { name: "診察履歴" })
        .click();
    await expect(page.getByRole("heading", { name: `${SEEDED_PATIENT.name} 様` })).toBeVisible();

    await renamePatient({ email: SEEDED_PATIENT.email, name: renamedPatientName });

    // ページを読み込み直すとキャッシュが消えるため、画面内のリンクだけで編集画面まで進む。
    await page.getByRole("link", { name: "患者一覧" }).click();
    await page
        .getByRole("row", { name: renamedPatientName })
        .getByRole("link", { name: "患者情報" })
        .click();

    await expect(page.getByRole("heading", { name: "患者情報を編集" })).toBeVisible();
    await expect(page.getByLabel("名前")).toHaveValue(renamedPatientName);
});

// 初期データの患者 1 人に加えて登録し、1 ページ（10 件）に収まらない 11 人にする。
// 行を名前で探すため、どの名前も他の名前の一部にならないようにする。
const ADDITIONAL_PATIENT_NAMES = [
    "青木 一郎",
    "石田 二郎",
    "上野 三郎",
    "江口 四郎",
    "大塚 五郎",
    "加藤 六郎",
    "木村 七郎",
    "工藤 八郎",
    "小林 九郎",
    "斉藤 十郎",
] as const;
const LAST_REGISTERED_PATIENT_NAME = ADDITIONAL_PATIENT_NAMES[ADDITIONAL_PATIENT_NAMES.length - 1];

test.describe("患者一覧の並べ替えとページ送り", () => {
    test("既定は ID の昇順で 1 ページ 10 件表示し、見出しを押すと並びが変わる", async ({ page }) => {
        for (const [index, name] of ADDITIONAL_PATIENT_NAMES.entries()) {
            await insertPatient({ ...SEEDED_PATIENT, name, email: `listed-patient-${index}@example.com` });
        }
        await logInAsSeededDoctor(page);
        const lastRegisteredPatientRow = page.getByRole("row", { name: LAST_REGISTERED_PATIENT_NAME });

        await test.step("最後に登録した 11 人目は 2 ページ目に表示される", async () => {
            await expect(page.getByText("全 11 件", { exact: true })).toBeVisible();
            await expect(lastRegisteredPatientRow).toHaveCount(0);

            await page.getByRole("button", { name: "2", exact: true }).click();

            await expect(lastRegisteredPatientRow).toBeVisible();
        });

        await test.step("ID の見出しを押すと降順になり、1 ページ目の先頭に最後に登録した患者が来る", async () => {
            await page.getByRole("button", { name: "ID", exact: true }).click();

            await expect(page.getByRole("columnheader", { name: "ID" })).toHaveAttribute(
                "aria-sort",
                "descending"
            );
            // 1 行目は見出しの行のため、データの先頭は 2 行目になる。
            await expect(page.getByRole("row").nth(1)).toContainText(LAST_REGISTERED_PATIENT_NAME);
        });
    });
});
