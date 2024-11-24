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
    extensionsToTreatAsEsm: ['.ts']
};
module.exports = config;
