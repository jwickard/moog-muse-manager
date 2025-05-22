module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/../src/renderer/__tests__/**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: [
    '<rootDir>/../src/renderer/__tests__/jest.setup.renderer.js'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1'
  }
}; 