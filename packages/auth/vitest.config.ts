import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        // secret.ts は JWT_SECRET_KEY が無ければ読み込み時点で throw する（ADR 0004 決定 3）。
        // テストを環境ファイルへ依存させないため、ここでテスト専用の値を明示する。
        // 署名と検証の双方がこの同じ値を使うだけなので、実際の秘密鍵である必要はない。
        env: {
            JWT_SECRET_KEY: "test-only-secret-key-not-used-in-any-environment",
        },
    },
});
