// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-app-data')
  },
  dialog: {
    showOpenDialog: jest.fn()
  }
})); 