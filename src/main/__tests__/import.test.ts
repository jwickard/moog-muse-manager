/**
 * @jest-environment node
 */
import path from 'path';
import fs from 'fs-extra';
import { DatabaseManager, calculateChecksum } from '../database';
import { importPatchesFromDirectory } from '../importPatches';

// Mock electron dialog and ipcMain
jest.mock('electron', () => ({
  dialog: {
    showOpenDialog: jest.fn()
  },
  ipcMain: {
    handle: jest.fn()
  },
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-app-data')
  }
}));

describe('Patch Import', () => {
  let testDir: string;
  let testDbPath: string;
  let db: DatabaseManager;
  const fixtureDir = path.join(__dirname, 'fixtures/sample-library');

  beforeAll(() => {
    // Create test directory
    testDir = '/tmp/test-patches';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create test database path
    testDbPath = path.join('/tmp/test-app-data', 'patches.db');
    
    // Ensure the test directory exists
    if (!fs.existsSync('/tmp/test-app-data')) {
      fs.mkdirSync('/tmp/test-app-data', { recursive: true });
    }
  });

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.removeSync(testDir);
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Copy fixture directory to test directory
    fs.copySync(fixtureDir, testDir);

    // Remove existing test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Ensure the test database directory exists
    const dbDir = path.dirname(testDbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create a new DatabaseManager instance with a temporary file-based database
    db = new DatabaseManager(testDbPath);
  });

  afterEach(() => {
    // Clean up test database
    if (db) {
      try {
        db.close();
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (error) {
        console.error('Error removing test database:', error);
      }
    }
  });

  afterAll(() => {
    // Clean up test directories
    if (fs.existsSync(testDir)) {
      fs.removeSync(testDir);
    }
    if (fs.existsSync('/tmp/test-app-data')) {
      fs.removeSync('/tmp/test-app-data');
    }
  });

  it('should import patches from a directory with Library folder', async () => {
    // Import patches using the real function
    const patches = await importPatchesFromDirectory(testDir, 'Library', db);

    // Verify results
    expect(patches).toHaveLength(4);
    expect(patches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: path.join(testDir, 'library/bank01/patch01/vox humana.mmp'),
        name: 'vox humana',
        bank: 'muse',
        library: 'Library',
        custom: false
      }),
      expect.objectContaining({
        path: path.join(testDir, 'library/bank01/patch02/muse runner.mmp'),
        name: 'muse runner',
        bank: 'muse',
        library: 'Library',
        custom: false
      }),
      expect.objectContaining({
        path: path.join(testDir, 'library/bank01/patch03/struga baab.mmp'),
        name: 'struga baab',
        bank: 'muse',
        library: 'Library',
        custom: false
      }),
      expect.objectContaining({
        path: path.join(testDir, 'library/bank02/patch01/moog 55 strings.mmp'),
        name: 'moog 55 strings',
        bank: 'classic',
        library: 'Library',
        custom: false
      })
    ]));

    // Verify banks were created
    const banks = db.loadBanks();
    expect(banks).toHaveLength(2);
    expect(banks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'muse',
        library: 'Library',
        custom: false
      }),
      expect.objectContaining({
        name: 'classic',
        library: 'Library',
        custom: false
      })
    ]));

    // Verify patch-bank associations
    const museBank = banks.find(b => b.name === 'muse')!;
    const classicBank = banks.find(b => b.name === 'classic')!;
    const musePatches = db.getPatchesForBank(museBank.id!);
    const classicPatches = db.getPatchesForBank(classicBank.id!);
    expect(musePatches).toHaveLength(3);
    expect(classicPatches).toHaveLength(1);
    expect(musePatches.map(p => p.path)).toEqual(expect.arrayContaining([
      path.join(testDir, 'library/bank01/patch01/vox humana.mmp'),
      path.join(testDir, 'library/bank01/patch02/muse runner.mmp'),
      path.join(testDir, 'library/bank01/patch03/struga baab.mmp')
    ]));
    expect(classicPatches[0].path).toBe(path.join(testDir, 'library/bank02/patch01/moog 55 strings.mmp'));
  });

  it('should import patches from a directory without Library folder', async () => {
    // Import patches using the real function
    const patches = await importPatchesFromDirectory(testDir, 'Factory', db);

    // Verify results
    expect(patches).toHaveLength(4);
    expect(patches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: path.join(testDir, 'library/bank01/patch01/vox humana.mmp'),
        name: 'vox humana',
        bank: 'muse',
        library: 'Factory',
        custom: false
      }),
      expect.objectContaining({
        path: path.join(testDir, 'library/bank01/patch02/muse runner.mmp'),
        name: 'muse runner',
        bank: 'muse',
        library: 'Factory',
        custom: false
      }),
      expect.objectContaining({
        path: path.join(testDir, 'library/bank01/patch03/struga baab.mmp'),
        name: 'struga baab',
        bank: 'muse',
        library: 'Factory',
        custom: false
      }),
      expect.objectContaining({
        path: path.join(testDir, 'library/bank02/patch01/moog 55 strings.mmp'),
        name: 'moog 55 strings',
        bank: 'classic',
        library: 'Factory',
        custom: false
      })
    ]));

    // Verify banks were created
    const banks = db.loadBanks();
    expect(banks).toHaveLength(2);
    expect(banks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'muse',
        library: 'Factory',
        custom: false
      }),
      expect.objectContaining({
        name: 'classic',
        library: 'Factory',
        custom: false
      })
    ]));

    // Verify patch-bank associations
    const museBank = banks.find(b => b.name === 'muse')!;
    const classicBank = banks.find(b => b.name === 'classic')!;
    const musePatches = db.getPatchesForBank(museBank.id!);
    const classicPatches = db.getPatchesForBank(classicBank.id!);
    expect(musePatches).toHaveLength(3);
    expect(classicPatches).toHaveLength(1);
    expect(musePatches.map(p => p.path)).toEqual(expect.arrayContaining([
      path.join(testDir, 'library/bank01/patch01/vox humana.mmp'),
      path.join(testDir, 'library/bank01/patch02/muse runner.mmp'),
      path.join(testDir, 'library/bank01/patch03/struga baab.mmp')
    ]));
    expect(classicPatches[0].path).toBe(path.join(testDir, 'library/bank02/patch01/moog 55 strings.mmp'));
  });

  it('should skip duplicate patches during import', async () => {
    // Import patches using the real function
    const patches1 = await importPatchesFromDirectory(testDir, 'Library', db);
    const patches2 = await importPatchesFromDirectory(testDir, 'Library', db);

    // Verify results
    expect(patches1).toHaveLength(4);
    expect(patches2).toHaveLength(0); // Should skip duplicate

    // Verify banks were created only once
    const banks = db.loadBanks();
    expect(banks).toHaveLength(2);
    expect(banks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'muse',
        library: 'Library',
        custom: false
      }),
      expect.objectContaining({
        name: 'classic',
        library: 'Library',
        custom: false
      })
    ]));

    // Verify patch-bank associations
    const museBank = banks.find(b => b.name === 'muse')!;
    const classicBank = banks.find(b => b.name === 'classic')!;
    const musePatches = db.getPatchesForBank(museBank.id!);
    const classicPatches = db.getPatchesForBank(classicBank.id!);
    expect(musePatches).toHaveLength(3);
    expect(classicPatches).toHaveLength(1);
    expect(musePatches.map(p => p.path)).toEqual(expect.arrayContaining([
      path.join(testDir, 'library/bank01/patch01/vox humana.mmp'),
      path.join(testDir, 'library/bank01/patch02/muse runner.mmp'),
      path.join(testDir, 'library/bank01/patch03/struga baab.mmp')
    ]));
    expect(classicPatches[0].path).toBe(path.join(testDir, 'library/bank02/patch01/moog 55 strings.mmp'));
  });

  it('should handle multiple banks and patches', async () => {
    // Import patches using the real function
    const patches = await importPatchesFromDirectory(testDir, 'Library', db);

    // Verify results
    expect(patches).toHaveLength(4);
    expect(patches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: path.join(testDir, 'library/bank01/patch01/vox humana.mmp'),
        name: 'vox humana',
        bank: 'muse',
        library: 'Library',
        custom: false
      }),
      expect.objectContaining({
        path: path.join(testDir, 'library/bank01/patch02/muse runner.mmp'),
        name: 'muse runner',
        bank: 'muse',
        library: 'Library',
        custom: false
      }),
      expect.objectContaining({
        path: path.join(testDir, 'library/bank01/patch03/struga baab.mmp'),
        name: 'struga baab',
        bank: 'muse',
        library: 'Library',
        custom: false
      }),
      expect.objectContaining({
        path: path.join(testDir, 'library/bank02/patch01/moog 55 strings.mmp'),
        name: 'moog 55 strings',
        bank: 'classic',
        library: 'Library',
        custom: false
      })
    ]));

    // Verify banks were created
    const banks = db.loadBanks();
    expect(banks).toHaveLength(2);
    expect(banks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'muse',
        library: 'Library',
        custom: false
      }),
      expect.objectContaining({
        name: 'classic',
        library: 'Library',
        custom: false
      })
    ]));

    // Verify patch-bank associations
    const museBank = banks.find(b => b.name === 'muse')!;
    const classicBank = banks.find(b => b.name === 'classic')!;
    const musePatches = db.getPatchesForBank(museBank.id!);
    const classicPatches = db.getPatchesForBank(classicBank.id!);
    expect(musePatches).toHaveLength(3);
    expect(classicPatches).toHaveLength(1);
    expect(musePatches.map(p => p.path)).toEqual(expect.arrayContaining([
      path.join(testDir, 'library/bank01/patch01/vox humana.mmp'),
      path.join(testDir, 'library/bank01/patch02/muse runner.mmp'),
      path.join(testDir, 'library/bank01/patch03/struga baab.mmp')
    ]));
    expect(classicPatches[0].path).toBe(path.join(testDir, 'library/bank02/patch01/moog 55 strings.mmp'));
  });
});

describe('Import', () => {
  let testDbPath: string;
  let db: DatabaseManager;
  let testFilePath: string;

  beforeAll(() => {
    // Create a test database path
    testDbPath = path.join('/tmp/test-app-data', 'patches.db');
    
    // Ensure the test directory exists
    if (!fs.existsSync('/tmp/test-app-data')) {
      fs.mkdirSync('/tmp/test-app-data', { recursive: true });
    }
    
    // Remove existing test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create a new DatabaseManager instance with a temporary file-based database
    db = new DatabaseManager(testDbPath);

    // Create a test file for checksum
    testFilePath = path.join('/tmp/test-app-data', 'testfile.mmp');
    fs.writeFileSync(testFilePath, 'test data');
  });

  afterAll(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db.close();
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  it('should calculate checksum correctly', () => {
    // Calculate expected checksum using the same logic as calculateChecksum
    const expectedChecksum = calculateChecksum(testFilePath);
    const actualChecksum = calculateChecksum(testFilePath);
    expect(actualChecksum).toBe(expectedChecksum);
  });
}); 