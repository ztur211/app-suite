import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'mjs', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j|mj)s$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/../tsconfig.jest.json',
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!**/main.ts', '!**/*.d.ts'],
  coverageDirectory: '../coverage/unit',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transformIgnorePatterns: [
    '/node_modules/(?!(better-auth|better-call|@better-fetch|@better-auth)/)',
  ],
};

export default config;
