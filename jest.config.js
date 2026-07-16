/** Jest config for the engine-free core logic (src/core). UI tests will use
 * jest-expo later; the core suite runs plain ts-jest in node. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/__tests__/**/*.test.ts'],
};
