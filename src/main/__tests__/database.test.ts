import { dbManager, Patch } from '../database';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-app-data')
  }
}));

describe('DatabaseManager', () => {
  let testDbPath: string;

  beforeEach(() => {
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
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbManager.close();
  });

  it('should create a new database with patches table', () => {
    const patches = dbManager.loadPatches();
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

    dbManager.savePatch(patch);
    const loadedPatches = dbManager.loadPatches();
    
    expect(loadedPatches).toHaveLength(1);
    expect(loadedPatches[0]).toEqual(patch);
  });

  it('should save and load a bank', () => {
    const bank = {
      name: 'Test Bank',
      library: 'Test Library',
      custom: false
    };

    const bankId = dbManager.saveBank(bank);
    const loadedBanks = dbManager.loadBanks();

    expect(loadedBanks).toHaveLength(1);
    expect(loadedBanks[0]).toEqual({
      id: bankId,
      ...bank
    });
  });

  it('should associate patches with banks', () => {
    const bank = {
      name: 'Test Bank',
      library: 'Test Library',
      custom: false
    };

    const bankId = dbManager.saveBank(bank);

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

    dbManager.savePatch(patch);
    const patches = dbManager.getPatchesForBank(bankId);

    expect(patches).toHaveLength(1);
    expect(patches[0]).toEqual(patch);
  });

  it('should handle duplicate banks', () => {
    const bank = {
      name: 'Test Bank',
      library: 'Test Library',
      custom: false
    };

    const bankId1 = dbManager.saveBank(bank);
    const bankId2 = dbManager.saveBank(bank);

    expect(bankId1).toBe(bankId2);
    expect(dbManager.loadBanks()).toHaveLength(1);
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

    dbManager.savePatches(patches);
    const loadedPatches = dbManager.loadPatches();
    
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

    dbManager.savePatch(patch);
    
    const updates = {
      loved: true,
      category: 'Updated Category',
      tags: ['updated', 'tags']
    };

    dbManager.updatePatchMetadata(patch.path, updates);
    const loadedPatches = dbManager.loadPatches();
    
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
    dbManager.savePatch(patch);
    dbManager.savePatch(patch);
    
    const loadedPatches = dbManager.loadPatches();
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

    expect(dbManager.patchExists(patch.checksum)).toBe(false);
    dbManager.savePatch(patch);
    expect(dbManager.patchExists(patch.checksum)).toBe(true);
  });
}); 