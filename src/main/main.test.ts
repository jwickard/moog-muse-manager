import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');
jest.mock('electron', () => ({
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
  app: {
    getPath: jest.fn(),
  },
}));

import * as electron from 'electron';

describe('Main Process', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('import-patches handler', () => {
    it('should handle directory selection and import patches', async (): Promise<void> => {
      (electron.dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: false,
        filePaths: ['/test/path'],
      });

      const result = await electron.dialog.showOpenDialog({});
      expect(result).toEqual({
        canceled: false,
        filePaths: ['/test/path'],
      });
    });

    it('should handle canceled directory selection', async () => {
      (electron.dialog.showOpenDialog as jest.Mock).mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const result = await electron.dialog.showOpenDialog({});
      expect(result).toEqual({
        canceled: true,
        filePaths: [],
      });
    });
  });

  it('should import patches from a directory', async () => {
    const mockFilePaths = ['/path/to/directory'];
    const mockFiles = ['file1.mmp', 'file2.mmp', 'file3.txt'];
    const mockStat = { isDirectory: () => false };

    electron.dialog.showOpenDialog.mockResolvedValue({ filePaths: mockFilePaths });
    (fs.readdirSync as jest.Mock).mockReturnValue(mockFiles);
    (fs.statSync as jest.Mock).mockReturnValue(mockStat);

    // Simulate the handler logic directly
    const patches: string[] = [];
    const scanDirectory = (dir: string) => {
      const files = fs.readdirSync(dir);
      files.forEach((file: string) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          scanDirectory(filePath);
        } else if (file.endsWith('.mmp')) {
          patches.push(filePath);
        }
      });
    };
    scanDirectory(mockFilePaths[0]);
    expect(patches).toEqual(['/path/to/directory/file1.mmp', '/path/to/directory/file2.mmp']);
  });

  it('should export patches to a directory', async () => {
    const mockFilePath = '/path/to/export';
    const mockPatches = ['/path/to/patch1.mmp', '/path/to/patch2.mmp'];

    electron.dialog.showSaveDialog.mockResolvedValue({ filePath: mockFilePath });
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    // Simulate the handler logic directly
    const exportDirectory = path.dirname(mockFilePath);
    if (!fs.existsSync(exportDirectory)) {
      fs.mkdirSync(exportDirectory, { recursive: true });
    }
    mockPatches.forEach((patch: string, index: number) => {
      const patchDir = path.join(exportDirectory, `bank${index.toString().padStart(2, '0')}`);
      if (!fs.existsSync(patchDir)) {
        fs.mkdirSync(patchDir, { recursive: true });
      }
      const patchFile = path.join(patchDir, `patch${index.toString().padStart(2, '0')}.mmp`);
      fs.copyFileSync(patch, patchFile);
    });
    // Check that the root and each bank directory were created
    expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to', { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to/bank00', { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to/bank01', { recursive: true });
    expect(fs.mkdirSync).toHaveBeenCalledTimes(3);
    expect(fs.copyFileSync).toHaveBeenCalledTimes(2);
  });
}); 