import { defineConfig, devices } from "@playwright/test";
import { DOCTOR_PAGES } from "./support/doctorPages.ts";
import { APP_ORIGIN } from "./support/testEnvironment.ts";

const isContinuousIntegration = Boolean(process.env.CI);

// webServer の起動には apps/web のビルドを含むため長めにとる。
const WEB_SERVER_STARTUP_TIMEOUT_MILLISECONDS = 5 * 60 * 1000;

export default defineConfig({
    testDir: "./tests",
    // アプリと DB は 1 組だけで、各テストの前に DB を初期化する（support/fixtures.ts）。
    // 並列に走らせると互いの初期化でデータが消えるため、1 ワーカーで順に実行する。
    workers: 1,
    forbidOnly: isContinuousIntegration,
    retries: 0,
    reporter: isContinuousIntegration ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: APP_ORIGIN,
        trace: "retain-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: "node scripts/startTestServer.ts",
        url: `${APP_ORIGIN}${DOCTOR_PAGES.LOGIN}`,
        timeout: WEB_SERVER_STARTUP_TIMEOUT_MILLISECONDS,
        // 手元では起動済みのサーバがあれば使い回す（ビルドを毎回待たないため）。
        reuseExistingServer: !isContinuousIntegration,
        stdout: "pipe",
        stderr: "pipe",
    },
});
