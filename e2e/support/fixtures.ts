import { test as base } from "@playwright/test";
import { resetDatabase } from "./testDatabase.ts";

// すべてのテストの前に DB を初期データへ戻す。
// テストファイルは @playwright/test ではなくこのファイルから test / expect を import する。
export const test = base.extend<{ databaseReset: void }>({
    databaseReset: [
        // Playwright の fixture は第 1 引数を分割代入で受け取る決まりのため、空のパターンを置く。
        async ({}, use) => {
            await resetDatabase();
            await use();
        },
        { auto: true },
    ],
});

export { expect } from "@playwright/test";
