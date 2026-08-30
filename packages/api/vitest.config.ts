import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        // prismaMock は @repo/db をモジュールごと差し替える。
        // 各テストファイルの import より前に評価される必要があるため setupFiles に置く。
        setupFiles: ["./test/prismaMock.ts"],
        clearMocks: true,
        // .env.test には NODE_ENV と JWT_SECRET_KEY しか無く、
        // このファイルは .gitignore 対象で CI からは見えない。
        // テストに必要な値はここで明示し、テストを環境ファイルに依存させない。
        env: {
            CLIENT_URL: "http://localhost:3000",
        },
    },
});
