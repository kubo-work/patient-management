import { expect, type Page } from "@playwright/test";

// 登録・更新が成功すると、アプリは一覧画面へ ?success=new / ?success=update を付けて遷移し、
// その値に応じた通知を出す（apps/web の useShowNotification）。
const SAVE_RESULT_MESSAGES = {
    new: "保存しました。",
    update: "更新しました。",
} as const;

type SaveResult = keyof typeof SAVE_RESULT_MESSAGES;

// 保存後に一覧画面へ戻り、通知が出て、保存した内容の行が表示されていることを確かめる。
export const expectSavedOnList = async (
    page: Page,
    { listPath, result, rowText }: { listPath: string; result: SaveResult; rowText: string }
): Promise<void> => {
    await expect(page).toHaveURL(
        (url) => url.pathname === listPath && url.searchParams.get("success") === result
    );
    await expect(page.getByText(SAVE_RESULT_MESSAGES[result], { exact: true })).toBeVisible();
    await expect(page.getByRole("row", { name: rowText })).toBeVisible();
};
