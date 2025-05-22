module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: [
    '<rootDir>/src/renderer/__tests__/jest.setup.renderer.js'
  ],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(better-sqlite3)/)'
  ]
};