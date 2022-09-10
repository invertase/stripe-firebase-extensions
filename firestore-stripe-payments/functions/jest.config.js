const packageJson = require('./package.json');

module.exports = {
  name: packageJson.name,
  displayName: packageJson.name,
  rootDir: './',
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/tsconfig.json',
    },
  },
  preset: 'ts-jest',
  testMatch: ['**/__tests__/tests/**/*.test.ts'],
  testEnvironment: 'node',
  testTimeout: 120000,
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/test-data/**',
  ],
  setupFiles: ['<rootDir>/__tests__/jest.setup.ts'],
  moduleNameMapper: {
    'firebase-admin/eventarc':
      '<rootDir>/node_modules/firebase-admin/lib/eventarc/index.js',
  },
};
