import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.(test|spec)\\.ts$',
  testPathIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['**/*.ts', '!**/__tests__/**', '!**/*.d.ts'],
  coverageDirectory: '../coverage/unit',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

export default config;
