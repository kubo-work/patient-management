// FIXME(#288): TypeScript 7 でこの設定は読み込めない。
// 7 系はコンパイラがネイティブ実装へ置き換わり、JS 版の Compiler API
// （typescript/lib/typescript.js）が撤廃された。ts-jest / ts-node はそれに依存して
// いるため、jest 起動時の jest.config.ts のパース段階で
// `TypeError: Cannot read properties of undefined (reading 'fileExists')` になる。
// テストは #288（Vitest + PGlite への移行）で復旧させる。それまで bun run test は動かない。
import type { Config } from "jest";

const config: Config = {
    transform: {
        "\\.[jt]sx?$": [
            "ts-jest",
            {
                "useESM": true,
                "tsconfig": "<rootDir>/tsconfig.test.json"
            }
        ]
    },
    moduleNameMapper: {
        "^(\\.\\.?\\/.+)\\.jsx?$": "$1",
        // dist（ESM）ではなく src の TS を ts-jest に変換させる
        "^@repo/schema$": "<rootDir>/../schema/src/index.ts"
    },
    clearMocks: true,
    preset: 'ts-jest',
    extensionsToTreatAsEsm: ['.ts'],
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/test/prismaMock.ts'],
};
module.exports = config;
