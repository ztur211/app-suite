// Suppresses noisy React Native warnings in test output that aren't actionable for unit tests.
// Add jest.mock() calls here for libraries that misbehave under jsdom/jest-expo if they appear later.

// Mock react-native-reanimated — Button in @things/design-system uses it and it requires native modules
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
