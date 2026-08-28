/** @type {import("jest").Config} */
export default {
    testEnvironment: "node",
    roots: ["<rootDir>/src"],
    setupFiles: ["<rootDir>/src/testing/jest.setup.ts"],
    testMatch: ["**/*.spec.ts"],
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                tsconfig: {
                    module: "CommonJS",
                    isolatedModules: true,
                    moduleResolution: "Node",
                    esModuleInterop: true,
                    strict: true,
                    types: ["jest", "node"],
                },
            },
        ],
    },
    moduleFileExtensions: ["ts", "js", "json"],
    clearMocks: true,
    testTimeout: 30000,
};
