import { defineConfig } from "vitest/config";

// パッケージごとの設定ファイルではなく、ルートのインライン projects として定義する。
// Vitest 5 ではインライン project が Vite の設定を変えない限り（root / plugins / alias 等を持たない限り）
// ルートの Vite サーバを共有する（sharedViteServer）。env や environment は共有を妨げない。
// 設定ファイルを参照する project は必ず自前のサーバを立てるため、ここに集約している。
//
// clearMocks は Vitest 5 から既定で true のため指定しない。
export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: "auth",
                    include: ["packages/auth/test/**/*.spec.ts"],
                    environment: "node",
                    // secret.ts は JWT_SECRET_KEY が無ければ読み込み時点で throw する（ADR 0004 決定 3）。
                    // テストを環境ファイルへ依存させないため、ここでテスト専用の値を明示する。
                    // 署名と検証の双方がこの同じ値を使うだけなので、実際の秘密鍵である必要はない。
                    env: {
                        JWT_SECRET_KEY: "test-only-secret-key-not-used-in-any-environment",
                    },
                },
            },
            {
                test: {
                    name: "api",
                    include: ["packages/api/test/**/*.spec.ts"],
                    environment: "node",
                    // .env.test は .gitignore 対象で CI からは見えないため、読み込まない。
                    // テストに必要な値はここで明示し、テストを環境ファイルに依存させない。
                    // NODE_ENV は Vitest が "test" を設定する。
                    env: {
                        CLIENT_URL: "http://localhost:3000",
                        // prismaMock を廃止したため @repo/db が実物として読み込まれる。
                        // 未設定だと読み込み時点で throw するので、接続しないダミーを置く。
                        // node-postgres の Pool も PrismaClient も生成時には接続せず、
                        // 初回クエリで初めて接続する。残るテストは認可や CSRF で先に止まり
                        // クエリまで到達しないため、この値で実際に接続することはない。
                        DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
                        // @repo/auth も未設定だと読み込み時点で throw する（ADR 0004 決定 3）。
                        // 署名と検証の双方がこの同じ値を使うだけなので、実際の秘密鍵である必要はない。
                        JWT_SECRET_KEY: "test-only-secret-key-not-used-in-any-environment",
                    },
                },
            },
        ],
    },
});
