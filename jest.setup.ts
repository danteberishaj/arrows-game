jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// The Reanimated mock has no useReducedMotion (GameScreen reads it for W2-05);
// tests that need reduced motion ON still mock it themselves.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
// W4-11 (ruling F33): GameScreen loads expo-store-review lazily and only with
// META_REVIEW_PROMPT on; no ui test may reach its native module. Tests that
// exercise the ask mock it themselves with call recording.
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => false),
  requestReview: jest.fn(async () => undefined),
  hasAction: jest.fn(async () => false),
  storeUrl: jest.fn(() => null),
}));
