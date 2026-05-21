import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|react-native-safe-area-context|react-native-screens|nativewind)',
  ],
  testRegex: '.*\\.(test|spec)\\.tsx?$',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

export default config;
