import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests', '<rootDir>/src'],
    testMatch: ['**/*.test.ts', '**/*.spec.ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    verbose: true,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
};

export default config;
