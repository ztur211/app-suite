// Mock react-native-reanimated for unit tests
// The real library requires native modules not available in Jest
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
