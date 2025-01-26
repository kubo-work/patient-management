import type { Config } from "jest";

const config: Config = {
    transform: {
        "\\.[jt]sx?$": [
            "ts-jest",
            {
                "useESM": true
            }
        ]
    },
    moduleNameMapper: {
        "^(\\.\\.?\\/.+)\\.jsx?$": "$1"
    },
    clearMocks: true,
    preset: 'ts-jest',
    extensionsToTreatAsEsm: ['.ts'],
    testEnvironment: 'node',
    // setupFilesAfterEnv: [
    //     '<rootDir>/test/doctor/login.spec.ts',
    //     '<rootDir>/test/doctor/login_doctor.spec.ts',
    // ],
};
module.exports = config;
