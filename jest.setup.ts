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
