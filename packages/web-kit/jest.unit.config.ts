import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  rootDir: 'src',
  testRegex: '.*\\.(test|spec)\\.(ts|tsx)$',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.expo/',
    '\\.integration\\.spec\\.(ts|tsx)$',
    '\\.e2e\\.spec\\.(ts|tsx)$',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|react-native-safe-area-context|react-native-screens|nativewind|react-native-reanimated)',
  ],
  collectCoverageFrom: ['**/*.{ts,tsx}', '!**/__tests__/**', '!**/*.d.ts'],
  coverageDirectory: '../coverage/unit',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

export default config;
