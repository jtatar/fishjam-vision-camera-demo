module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  resolver: 'react-native-worklets/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
};
