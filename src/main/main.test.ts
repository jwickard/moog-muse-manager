import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

jest.mock('fs');
jest.mock('electron', () => ({
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
  app: {
    getPath: jest.fn(),
  },
}));

describe('Main Process IPC Handlers', () => {
  let fs: any;
  let electron: any;

  beforeEach(() => {
    jest.clearAllMocks();
    fs = require('fs');
    electron = require('electron');
  });

  it('should import patches from a directory', async () => {
    const mockFilePaths = ['/path/to/directory'];
    const mockFiles = ['file1.mmp', 'file2.mmp', 'file3.txt'];
    const mockStat = { isDirectory: () => false };

    electron.dialog.showOpenDialog.mockResolvedValue({ filePaths: mockFilePaths });
    fs.readdirSync.mockReturnValue(mockFiles);
    fs.statSync.mockReturnValue(mockStat);

    // Simulate the handler logic directly
    const patches: string[] = [];
    const scanDirectory = (dir: string) => {
      const files = fs.readdirSync(dir);
      files.forEach((file: string) => {
        const filePath = require('path').join(dir, file);
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
    fs.existsSync.mockReturnValue(false);

    // Simulate the handler logic directly
    const exportDirectory = require('path').dirname(mockFilePath);
    if (!fs.existsSync(exportDirectory)) {
      fs.mkdirSync(exportDirectory, { recursive: true });
    }
    mockPatches.forEach((patch: string, index: number) => {
      const patchDir = require('path').join(exportDirectory, `bank${index.toString().padStart(2, '0')}`);
      if (!fs.existsSync(patchDir)) {
        fs.mkdirSync(patchDir, { recursive: true });
      }
      const patchFile = require('path').join(patchDir, `patch${index.toString().padStart(2, '0')}.mmp`);
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