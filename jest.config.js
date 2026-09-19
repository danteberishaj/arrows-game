/** Component tests cannot verify visuals, layout, Reanimated, Skia or native output.
 * Those close only on P-02 captures. */
module.exports = {
  projects: [
    {
      displayName: 'core',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/src/**/__tests__/**/*.test.ts'],
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      testMatch: ['**/src/**/__tests__/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
};
