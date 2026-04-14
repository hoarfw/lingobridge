/**
 * Jest configuration for LingoBridge Chrome Extension
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.planning/'
  ],

  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/__tests__/**',
    '!src/**/*.test.js'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },

  // Module name mapper for Chrome API mocks
  moduleNameMapper: {
    '^(chrome/.*)$': '<rootDir>/__mocks__/$1',
    '^(\\.{1,2}/.*)\\.js)$': '$1'
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Transform
  transform: {},

  // Ignore certain Chrome API issues
  ignoreInterceptErrors: true
};
