/**
 * @jest-environment node
 */
import { DatabaseManager, Patch } from '../database';
import path from 'path';
import fs from 'fs';

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-app-data')
  }
}));

describe('DatabaseManager', () => {
  let testDbPath: string;
  let db: DatabaseManager;

  beforeAll(() => {
    // Create a test database path
    testDbPath = path.join('/tmp/test-app-data', 'patches.db');
    
    // Ensure the test directory exists
    if (!fs.existsSync('/tmp/test-app-data')) {
      fs.mkdirSync('/tmp/test-app-data', { recursive: true });
    }
  });

  beforeEach(() => {
    // Remove existing test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create a new DatabaseManager instance with a temporary file-based database
    db = new DatabaseManager(testDbPath);
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db.close();
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync('/tmp/test-app-data')) {
      fs.rmSync('/tmp/test-app-data', { recursive: true, force: true });
    }
  });

  it('should create a new database with patches table', () => {
    const patches = db.loadPatches();
    expect(patches).toEqual([]);
  });

  it('should save and load a single patch', () => {
    const patch: Patch = {
      path: '/test/path/patch1.mmp',
      name: 'Test Patch',
      loved: true,
      category: 'Test Category',
      tags: ['test', 'patch'],
      bank: 'testbank',
      library: 'testlib',
      checksum: 'testchecksum123',
      custom: true
    };

    db.savePatch(patch);
    const loadedPatches = db.loadPatches();
    
    expect(loadedPatches).toHaveLength(1);
    expect(loadedPatches[0]).toEqual(patch);
  });

  it('should save and load a bank', () => {
    const bank = {
      name: 'Test Bank',
      library: 'Test Library',
      custom: false
    };

    const bankId = db.saveBank(bank);
    const loadedBanks = db.loadBanks();

    expect(loadedBanks).toHaveLength(1);
    expect(loadedBanks[0]).toEqual({
      id: bankId,
      ...bank
    });
  });

  it('should associate patches with banks', () => {
    // First save the bank
    const bank = {
      name: 'Test Bank',
      library: 'Test Library',
      custom: false
    };

    const bankId = db.saveBank(bank);

    // Then save the patch
    const patch: Patch = {
      path: '/test/path/patch1.mmp',
      name: 'Test Patch',
      loved: true,
      category: 'Test Category',
      tags: ['test', 'patch'],
      bank: bank.name,
      library: bank.library,
      checksum: 'testchecksum123',
      custom: false
    };

    db.savePatch(patch);

    // Associate the patch with the bank
    const stmt = db['db'].prepare(`
      INSERT INTO patch_banks (patch_path, bank_id)
      VALUES (?, ?)
    `);
    stmt.run(patch.path, bankId);

    // Get patches for the bank
    const patches = db.getPatchesForBank(bankId);

    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual(patch);
  });

  it('should handle duplicate banks', () => {
    const bank = {
      name: 'Test Bank',
      library: 'Test Library',
      custom: false
    };

    const bankId1 = db.saveBank(bank);
    const bankId2 = db.saveBank(bank);

    expect(bankId1).toBe(bankId2);
    expect(db.loadBanks()).toHaveLength(1);
  });

  it('should save and load multiple patches', () => {
    const patches: Patch[] = [
      {
        path: '/test/path/patch1.mmp',
        name: 'Test Patch 1',
        loved: true,
        category: 'Test Category',
        tags: ['test', 'patch'],
        bank: 'testbank',
        library: 'testlib',
        checksum: 'testchecksum123',
        custom: true
      },
      {
        path: '/test/path/patch2.mmp',
        name: 'Test Patch 2',
        loved: false,
        category: 'Another Category',
        tags: ['another'],
        bank: 'anotherbank',
        library: 'testlib',
        checksum: 'testchecksum456',
        custom: false
      }
    ];

    db.savePatches(patches);
    const loadedPatches = db.loadPatches();
    
    expect(loadedPatches).toHaveLength(2);
    expect(loadedPatches).toEqual(expect.arrayContaining(patches));
  });

  it('should update patch metadata', () => {
    const patch: Patch = {
      path: '/test/path/patch1.mmp',
      name: 'Test Patch',
      loved: false,
      category: 'Test Category',
      tags: ['test'],
      bank: 'testbank',
      library: 'testlib',
      checksum: 'testchecksum123',
      custom: false
    };

    db.savePatch(patch);
    
    const updates = {
      loved: true,
      category: 'Updated Category',
      tags: ['updated', 'tags']
    };

    db.updatePatchMetadata(patch.path, updates);
    const loadedPatches = db.loadPatches();
    
    expect(loadedPatches).toHaveLength(1);
    expect(loadedPatches[0]).toEqual({
      ...patch,
      ...updates
    });
  });

  it('should not save duplicate patches', () => {
    const patch: Patch = {
      path: '/test/path/patch1.mmp',
      name: 'Test Patch',
      loved: false,
      category: 'Test Category',
      tags: ['test'],
      bank: 'testbank',
      library: 'testlib',
      checksum: 'testchecksum123',
      custom: false
    };

    // Save the same patch twice
    db.savePatch(patch);
    db.savePatch(patch);
    
    const loadedPatches = db.loadPatches();
    expect(loadedPatches).toHaveLength(1);
  });

  it('should check if a patch exists by checksum', () => {
    const patch: Patch = {
      path: '/test/path/patch1.mmp',
      name: 'Test Patch',
      loved: false,
      category: 'Test Category',
      tags: ['test'],
      bank: 'testbank',
      library: 'testlib',
      checksum: 'testchecksum123',
      custom: false
    };

    expect(db.patchExists(patch.checksum)).toBe(false);
    db.savePatch(patch);
    expect(db.patchExists(patch.checksum)).toBe(true);
  });
}); 