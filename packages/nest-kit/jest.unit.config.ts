import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.(test|spec)\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.spec\\.ts$', '\\.e2e\\.spec\\.ts$'],
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
