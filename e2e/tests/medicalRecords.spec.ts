import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../support/fixtures.ts";
import { DOCTOR_PAGES } from "../support/doctorPages.ts";
import { logInAsSeededDoctor } from "../support/login.ts";
import {
    findPatientIdByEmail,
    insertDoctor,
    insertPatient,
    SEEDED_CATEGORIES,
    SEEDED_DOCTOR,
    SEEDED_PATIENT,
} from "../support/testDatabase.ts";

const [ELECTRIC_THERAPY, MANUAL_THERAPY] = SEEDED_CATEGORIES.CHILDREN;

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
        .getByRole("row", { name: SEEDED_PATIENT.name })
        .getByRole("link", { name: "診察履歴" })
        .click();
    await expect(page.getByRole("heading", { name: `${SEEDED_PATIENT.name} 様` })).toBeVisible();
};

// 開いている診察履歴画面で、指定した子カテゴリとメモの診察を作成し、一覧に表示されるまで待つ。
const createMedicalRecord = async (
    page: Page,
    { childTreatment, memo }: { childTreatment: string; memo: string }
): Promise<void> => {
    await page.getByRole("button", { name: "新しい診察を作成" }).click();
    const dialog = page.getByRole("dialog", { name: "新しい診察を作成" });
    await toggleCategories(dialog, [childTreatment]);
    await dialog.getByLabel("メモ", { exact: true }).fill(memo);
    await dialog.getByRole("button", { name: "保存" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("診察を保存しました。", { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: childTreatment })).toBeVisible();
};

// 患者 ID で診察履歴画面を開き、その患者の名前の見出しが表示されるまで待つ。
const openMedicalRecordsOf = async (
    page: Page,
    { patientId, patientName }: { patientId: number; patientName: string }
): Promise<void> => {
    await page.goto(`${DOCTOR_PAGES.MEDICAL_RECORDS}?patients_id=${patientId}`);
    await expect(page.getByRole("heading", { name: `${patientName} 様` })).toBeVisible();
};

test("診察履歴から診察を作成し、編集して、削除できる", async ({ page }) => {
    await logInAsSeededDoctor(page);
    await openMedicalRecordsOfSeededPatient(page);

    await test.step("新しい診察を作成する", async () => {
        await createMedicalRecord(page, { childTreatment: ELECTRIC_THERAPY, memo: "右足首を捻った" });
    });

    await test.step("診察のカテゴリを入れ替えて更新する", async () => {
        await page.getByRole("row", { name: ELECTRIC_THERAPY }).getByRole("button", { name: "編集" }).click();
        const dialog = page.getByRole("dialog", { name: "診察編集" });
        await toggleCategories(dialog, [ELECTRIC_THERAPY, MANUAL_THERAPY]);
        await dialog.getByLabel("メモ", { exact: true }).fill("転倒して膝も打った");
        await dialog.getByRole("button", { name: "更新" }).click();

        await expect(dialog).toBeHidden();
        await expect(page.getByText("診察を更新しました。", { exact: true })).toBeVisible();
        await expect(page.getByRole("row", { name: MANUAL_THERAPY })).toBeVisible();
        await expect(page.getByRole("row", { name: ELECTRIC_THERAPY })).toHaveCount(0);
    });

    await test.step("診察を削除する", async () => {
        await page.getByRole("row", { name: MANUAL_THERAPY }).getByRole("button", { name: "編集" }).click();
        const dialog = page.getByRole("dialog", { name: "診察編集" });
        // 削除は window.confirm で確認する。Playwright は既定で確認ダイアログを閉じる（= キャンセル）ため、
        // この操作に限って OK を押す。
        page.once("dialog", (confirmDialog) => confirmDialog.accept());
        await dialog.getByRole("button", { name: "削除" }).click();

        await expect(dialog).toBeHidden();
        await expect(page.getByText("診察を削除しました。", { exact: true })).toBeVisible();
        await expect(page.getByRole("row", { name: MANUAL_THERAPY })).toHaveCount(0);
    });
});

// 以前は保存時に患者名で全患者から患者を探しており、同じ名前の患者がいると
// 先に登録された患者の診察として保存されていた。
test("同じ名前の患者がいても、開いている患者の診察として保存される", async ({ page }) => {
    const seededPatientId = await findPatientIdByEmail(SEEDED_PATIENT.email);
    const sameNamePatientId = await insertPatient({
        ...SEEDED_PATIENT,
        email: "same-name-patient@example.com",
    });
    await logInAsSeededDoctor(page);

    await openMedicalRecordsOf(page, { patientId: sameNamePatientId, patientName: SEEDED_PATIENT.name });
    await createMedicalRecord(page, { childTreatment: ELECTRIC_THERAPY, memo: "右足首を捻った" });

    await openMedicalRecordsOf(page, { patientId: seededPatientId, patientName: SEEDED_PATIENT.name });
    await expect(page.getByRole("row", { name: ELECTRIC_THERAPY })).toHaveCount(0);
});

// 担当者の欄は、選択済みの選択肢をもう一度押すと選択が外れる（Mantine の Select の既定）。
test("担当者の選択を外すと保存できず、別の医師を選ぶとその医師の診察として保存される", async ({ page }) => {
    const otherDoctor = { name: "医師 二郎", email: "second-doctor@example.com" };
    await insertDoctor(otherDoctor);
    await logInAsSeededDoctor(page);
    await openMedicalRecordsOfSeededPatient(page);

    await page.getByRole("button", { name: "新しい診察を作成" }).click();
    const createDialog = page.getByRole("dialog", { name: "新しい診察を作成" });
    const doctorSelect = createDialog.getByRole("combobox", { name: "担当者" });
    // 新規作成では、ログイン中の医師が担当者として選ばれている。
    await expect(doctorSelect).toHaveValue(SEEDED_DOCTOR.name);

    await test.step("担当者の選択を外すと保存できない", async () => {
        await doctorSelect.click();
        await page.getByRole("option", { name: SEEDED_DOCTOR.name }).click();
        await expect(doctorSelect).toHaveValue("");
        await createDialog.getByRole("button", { name: "保存" }).click();

        await expect(createDialog.getByText("選択してください。", { exact: true })).toBeVisible();
        await expect(createDialog).toBeVisible();
    });

    await test.step("別の医師を選んで保存する", async () => {
        await doctorSelect.click();
        await page.getByRole("option", { name: otherDoctor.name }).click();
        await expect(doctorSelect).toHaveValue(otherDoctor.name);
        await toggleCategories(createDialog, [ELECTRIC_THERAPY]);
        await createDialog.getByRole("button", { name: "保存" }).click();

        await expect(createDialog).toBeHidden();
        await expect(page.getByText("診察を保存しました。", { exact: true })).toBeVisible();
    });

    await test.step("保存した診察を開き直すと、選んだ医師が担当者になっている", async () => {
        await page.getByRole("row", { name: ELECTRIC_THERAPY }).getByRole("button", { name: "編集" }).click();
        const editDialog = page.getByRole("dialog", { name: "診察編集" });
        await expect(editDialog.getByRole("combobox", { name: "担当者" })).toHaveValue(otherDoctor.name);
    });
});
