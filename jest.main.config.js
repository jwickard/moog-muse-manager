module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/main/__tests__/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(better-sqlite3)/)'
  ]
}; 