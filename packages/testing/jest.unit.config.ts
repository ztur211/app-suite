import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.(test|spec)\\.ts$',
  // Keep integration/e2e tests out of the unit run. The matchers mirror
  // jest.integration/e2e.config's `.(test|spec).ts` regex — postgres.integration.test.ts
  // uses `.test.ts`, which the old `.spec.ts`-only patterns let leak in.
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.(test|spec)\\.ts$',
    '\\.e2e\\.(test|spec)\\.ts$',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: ['**/*.ts', '!**/__tests__/**', '!**/*.d.ts'],
  coverageDirectory: '../coverage/unit',
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
          keepClassNames: true,
        },
      },
    ],
  },
};

export default config;
