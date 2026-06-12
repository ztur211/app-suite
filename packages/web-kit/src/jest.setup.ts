// Mock react-native-reanimated for unit tests — the real library needs native
// modules unavailable in Jest. LoginScreen pulls it in via @things/design-system.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
