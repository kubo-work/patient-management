import { defineConfig } from "vitest/config";

// パッケージごとの設定ファイルではなく、ルートのインライン projects として定義する。
// Vitest 5 ではインライン project が Vite の設定を変えない限り（root / plugins / alias 等を持たない限り）
// ルートの Vite サーバを共有する（sharedViteServer）。env や environment、setupFiles は共有を妨げない。
// 設定ファイルを参照する project は必ず自前のサーバを立てるため、ここに集約している。
//
// clearMocks は Vitest 5 から既定で true のため指定しない。

// 署名と検証の双方がこの同じ値を使うだけなので、実際の秘密鍵である必要はない。
const testJwtSecretKey = "test-only-secret-key-not-used-in-any-environment";

// .env.test は .gitignore 対象で CI からは見えないため、読み込まない。
// テストに必要な値はここで明示し、テストを環境ファイルに依存させない。
// NODE_ENV は Vitest が "test" を設定する。
const apiTestEnvironment = {
    CLIENT_URL: "http://localhost:3000",
    // @repo/auth は未設定だと読み込み時点で throw する（ADR 0004 決定 3）。
    JWT_SECRET_KEY: testJwtSecretKey,
};

const apiIntegrationTestDirectory = "packages/api/test/integration/**";

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: "auth",
                    include: ["packages/auth/test/**/*.spec.ts"],
                    environment: "node",
                    // secret.ts は JWT_SECRET_KEY が無ければ読み込み時点で throw する（ADR 0004 決定 3）。
                    env: {
                        JWT_SECRET_KEY: testJwtSecretKey,
                    },
                },
            },
            {
                // DB に触れないテスト（domain / 認可 / CSRF など）。
                test: {
                    name: "api",
                    include: ["packages/api/test/**/*.spec.ts"],
                    exclude: [apiIntegrationTestDirectory],
                    environment: "node",
                    env: {
                        ...apiTestEnvironment,
                        // @repo/db は未設定だと読み込み時点で throw するので、接続しないダミーを置く。
                        // node-postgres の Pool も PrismaClient も生成時には接続せず、
                        // 初回クエリで初めて接続する。この project のテストは認可や CSRF で先に止まり
                        // クエリまで到達しないため、この値で実際に接続することはない。
                        DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
                    },
                },
            },
            {
                // repository / router を実 Postgres（PGlite）で検証する結合テスト。
                // DATABASE_URL は setupFiles がテストファイルごとに立てる PGlite を指すよう設定する。
                test: {
                    name: "api-integration",
                    include: [`${apiIntegrationTestDirectory}/*.spec.ts`],
                    environment: "node",
                    // テストファイル間でモジュールを共有し、PGlite と Prisma の初期化を
                    // ワーカーごとに 1 回で済ませる（test/support/testDatabaseServer.ts）。
                    // ファイル間の独立性は、各テストの前の TRUNCATE で保つ。
                    isolate: false,
                    // ワーカーを増やすと、その数だけ初期化（約 1 秒）が同時に走り CPU を奪い合う。
                    // 実測ではワーカー 1〜2 が最速だった（7 ワーカーより約 2 秒速い）。
                    maxWorkers: 2,
                    // maxWorkers が他の project と違う場合、実行グループを分ける必要がある。
                    // 単体テスト（groupOrder: 0）の後に実行される。
                    sequence: { groupOrder: 1 },
                    // globalSetup がマイグレーション適用済みの PGlite を 1 回だけ作ってダンプし、
                    // 各ワーカーがそこから復元する。
                    globalSetup: ["packages/api/test/support/pgliteTemplateGlobalSetup.ts"],
                    setupFiles: ["packages/api/test/support/pgliteDatabase.ts"],
                    env: apiTestEnvironment,
                },
            },
        ],
    },
});
