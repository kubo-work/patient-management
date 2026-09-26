import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        clearMocks: true,
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
});
