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
