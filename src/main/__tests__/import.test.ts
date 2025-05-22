import { dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { dbManager } from '../database';

// Mock electron app and dialog
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-app-data')
  },
  dialog: {
    showOpenDialog: jest.fn()
  }
}));

describe('Patch Import', () => {
  let testDir: string;
  let testLibraryDir: string;

  beforeEach(() => {
    // Create test directory structure
    testDir = '/tmp/test-patches';
    testLibraryDir = path.join(testDir, 'Library');
    
    // Clean up and create fresh test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(testLibraryDir, { recursive: true });

    // Mock dialog to return our test directory
    (dialog.showOpenDialog as jest.Mock).mockResolvedValue({
      filePaths: [testDir]
    });
  });

  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    dbManager.close();
  });

  it('should import patches from a directory with Library folder', async () => {
    // Create test bank structure
    const bankDir = path.join(testLibraryDir, 'bank01');
    fs.mkdirSync(bankDir, { recursive: true });
    
    // Create a bank file
    fs.writeFileSync(path.join(bankDir, 'userbank.bank'), '');
    
    // Create patch directories and files
    const patchDir = path.join(bankDir, 'patch01');
    fs.mkdirSync(patchDir, { recursive: true });
    fs.writeFileSync(path.join(patchDir, 'testpatch.mmp'), 'test content');

    // Import patches
    const patches = await dbManager.loadPatches();
    
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      name: 'testpatch',
      bank: 'userbank',
      custom: true,
      tags: ['userbank']
    });
  });

  it('should import patches from a directory without Library folder', async () => {
    // Create test bank structure directly in root
    const bankDir = path.join(testDir, 'bank01');
    fs.mkdirSync(bankDir, { recursive: true });
    
    // Create a bank file
    fs.writeFileSync(path.join(bankDir, 'factorybank.bank'), '');
    
    // Create patch directories and files
    const patchDir = path.join(bankDir, 'patch01');
    fs.mkdirSync(patchDir, { recursive: true });
    fs.writeFileSync(path.join(patchDir, 'testpatch.mmp'), 'test content');

    // Import patches
    const patches = await dbManager.loadPatches();
    
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      name: 'testpatch',
      bank: 'factorybank',
      custom: false,
      tags: ['factorybank']
    });
  });

  it('should skip duplicate patches during import', async () => {
    // Create test bank structure
    const bankDir = path.join(testLibraryDir, 'bank01');
    fs.mkdirSync(bankDir, { recursive: true });
    
    // Create a bank file
    fs.writeFileSync(path.join(bankDir, 'testbank.bank'), '');
    
    // Create patch directories and files
    const patchDir = path.join(bankDir, 'patch01');
    fs.mkdirSync(patchDir, { recursive: true });
    fs.writeFileSync(path.join(patchDir, 'testpatch.mmp'), 'test content');

    // Import patches twice
    const patches1 = await dbManager.loadPatches();
    const patches2 = await dbManager.loadPatches();
    
    expect(patches1).toHaveLength(1);
    expect(patches2).toHaveLength(1);
  });

  it('should handle multiple banks and patches', async () => {
    // Create multiple test banks
    const banks = ['bank01', 'bank02'];
    banks.forEach(bankName => {
      const bankDir = path.join(testLibraryDir, bankName);
      fs.mkdirSync(bankDir, { recursive: true });
      fs.writeFileSync(path.join(bankDir, `${bankName}.bank`), '');
      
      // Create multiple patch directories
      ['patch01', 'patch02'].forEach(patchName => {
        const patchDir = path.join(bankDir, patchName);
        fs.mkdirSync(patchDir, { recursive: true });
        fs.writeFileSync(path.join(patchDir, `${patchName}.mmp`), 'test content');
      });
    });

    // Import patches
    const patches = await dbManager.loadPatches();
    
    expect(patches).toHaveLength(4); // 2 banks * 2 patches each
    expect(patches.map(p => p.bank)).toEqual(expect.arrayContaining(['bank01', 'bank02']));
    // Verify all patches have their bank names as tags
    patches.forEach(patch => {
      expect(patch.tags).toContain(patch.bank);
    });
  });
}); 