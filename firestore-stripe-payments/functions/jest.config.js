const packageJson = require('./package.json');

module.exports = {
  displayName: packageJson.name,
  testEnvironment: 'node',
  rootDir: './',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  globalSetup: '<rootDir>/__tests__/jest.global-setup.ts',
  globalTeardown: '<rootDir>/__tests__/jest.global-teardown.ts',
  testMatch:
    process.env.INTEGRATION_TEST === 'true'
      ? ['**/__tests__/tests/**/*.test.ts']
      : ['**/__tests__/tests/unit/**/*.test.ts'],
  testTimeout: 120000,
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/test-data/**',
  ],
  moduleNameMapper: {
    'firebase-admin/eventarc':
      '<rootDir>/node_modules/firebase-admin/lib/eventarc',
    'firebase-admin/auth': '<rootDir>/node_modules/firebase-admin/lib/auth',
    'firebase-admin/app': '<rootDir>/node_modules/firebase-admin/lib/app',
    'firebase-admin/database':
      '<rootDir>/node_modules/firebase-admin/lib/database',
    'firebase-admin/firestore':
      '<rootDir>/node_modules/firebase-admin/lib/firestore',
    'firebase-admin/functions':
      '<rootDir>/node_modules/firebase-admin/lib/functions',
    'firebase-functions/v2': '<rootDir>/node_modules/firebase-functions/lib/v2',
    'firebase-admin/extensions':
      '<rootDir>/node_modules/firebase-admin/lib/extensions',
  },
};
