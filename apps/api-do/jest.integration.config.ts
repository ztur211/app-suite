import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'mjs', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.integration\\.spec\\.ts$',
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
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transformIgnorePatterns: [
    '/node_modules/(?!(better-auth|better-call|@better-fetch|@better-auth|@noble|jose|nanoid|rou3|uncrypto|defu|destr|hookable|ufo|ohash|radix3|h3|cookie-es|iron-webcrypto|klona)/).*',
  ],
  // Integration tests boot real NestJS app + Postgres testcontainer
  testTimeout: 120000,
  globalSetup: '<rootDir>/../jest.integration.globalSetup.ts',
};

export default config;
