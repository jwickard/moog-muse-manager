import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import crypto from 'crypto';

interface Patch {
  path: string;
  name: string;
  loved: boolean;
  category: string;
  tags: string[];
  bank: string;
  library: string;
  checksum: string;
  custom: boolean;
}

interface Bank {
  id: number;
  name: string;
  library: string;
  custom: boolean;
}

interface PatchRow {
  path: string;
  name: string;
  loved: number; // SQLite stores booleans as 0/1
  category: string;
  tags: string;
  bank: string;
  library: string;
  checksum: string;
  custom: number; // SQLite stores booleans as 0/1
}

interface BankRow {
  id: number;
  name: string;
  library: string;
  custom: number;
}

function calculateChecksum(patchPath: string): string {
  const fileContent = fs.readFileSync(patchPath);
  const directoryName = path.dirname(patchPath);
  const combinedData = Buffer.concat([
    Buffer.from(directoryName),
    fileContent
  ]);
  return crypto.createHash('md5').update(combinedData).digest('hex');
}

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    // Ensure the user data directory exists
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    // Initialize the database
    const dbPath = path.join(userDataPath, 'patches.db');
    this.db = new Database(dbPath);

    // Create the banks table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        library TEXT NOT NULL,
        custom BOOLEAN DEFAULT FALSE,
        UNIQUE(name, library)
      )
    `);

    // Create the patches table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patches (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        loved BOOLEAN DEFAULT FALSE,
        category TEXT,
        tags TEXT,
        bank TEXT NOT NULL,
        library TEXT NOT NULL,
        checksum TEXT NOT NULL UNIQUE,
        custom BOOLEAN DEFAULT FALSE
      )
    `);

    // Create the patch_banks junction table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patch_banks (
        patch_path TEXT,
        bank_id INTEGER,
        PRIMARY KEY (patch_path, bank_id),
        FOREIGN KEY (patch_path) REFERENCES patches(path) ON DELETE CASCADE,
        FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE
      )
    `);
  }

  // Save a bank and return its ID
  saveBank(bank: Omit<Bank, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO banks (name, library, custom)
      VALUES (@name, @library, @custom)
    `);

    const result = stmt.run({
      name: bank.name,
      library: bank.library,
      custom: bank.custom ? 1 : 0
    });

    // If the bank already exists, get its ID
    if (result.changes === 0) {
      const existingBank = this.db.prepare('SELECT id FROM banks WHERE name = ? AND library = ?')
        .get(bank.name, bank.library) as { id: number };
      return existingBank.id;
    }

    return result.lastInsertRowid as number;
  }

  // Get a bank by name and library
  getBank(name: string, library: string): Bank | null {
    const stmt = this.db.prepare('SELECT * FROM banks WHERE name = ? AND library = ?');
    const bank = stmt.get(name, library) as BankRow | undefined;
    
    if (!bank) return null;
    
    return {
      id: bank.id,
      name: bank.name,
      library: bank.library,
      custom: Boolean(bank.custom)
    };
  }

  // Associate a patch with a bank
  associatePatchWithBank(patchPath: string, bankId: number): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO patch_banks (patch_path, bank_id)
      VALUES (@patchPath, @bankId)
    `);

    stmt.run({ patchPath, bankId });
  }

  // Get all banks
  loadBanks(): Bank[] {
    const stmt = this.db.prepare('SELECT * FROM banks');
    const rows = stmt.all() as BankRow[];
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      library: row.library,
      custom: Boolean(row.custom)
    }));
  }

  // Get all patches for a bank
  getPatchesForBank(bankId: number): Patch[] {
    const stmt = this.db.prepare(`
      SELECT p.* FROM patches p
      JOIN patch_banks pb ON p.path = pb.patch_path
      WHERE pb.bank_id = ?
    `);
    
    const rows = stmt.all(bankId) as PatchRow[];
    
    return rows.map(row => ({
      path: row.path,
      name: row.name,
      loved: Boolean(row.loved),
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      bank: row.bank,
      library: row.library,
      checksum: row.checksum,
      custom: Boolean(row.custom)
    }));
  }

  // Save a single patch
  savePatch(patch: Patch): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO patches (path, name, loved, category, tags, bank, library, checksum, custom)
      VALUES (@path, @name, @loved, @category, @tags, @bank, @library, @checksum, @custom)
    `);

    stmt.run({
      path: patch.path,
      name: patch.name,
      loved: patch.loved ? 1 : 0,
      category: patch.category || null,
      tags: JSON.stringify(patch.tags || []),
      bank: patch.bank,
      library: patch.library,
      checksum: patch.checksum,
      custom: patch.custom ? 1 : 0
    });

    // Create or get bank and associate with patch
    const bankId = this.saveBank({
      name: patch.bank,
      library: patch.library,
      custom: patch.custom
    });

    this.associatePatchWithBank(patch.path, bankId);
  }

  // Save multiple patches
  savePatches(patches: Patch[]): void {
    const insertMany = this.db.transaction((patches: Patch[]) => {
      for (const patch of patches) {
        this.savePatch(patch);
      }
    });

    insertMany(patches);
  }

  // Load all patches
  loadPatches(): Patch[] {
    const stmt = this.db.prepare('SELECT * FROM patches');
    const rows = stmt.all() as PatchRow[];
    
    return rows.map(row => ({
      path: row.path,
      name: row.name,
      loved: Boolean(row.loved),
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      bank: row.bank,
      library: row.library,
      checksum: row.checksum,
      custom: Boolean(row.custom)
    }));
  }

  // Update a patch's metadata
  updatePatchMetadata(path: string, updates: Partial<Patch>): void {
    const patch = this.db.prepare('SELECT * FROM patches WHERE path = ?').get(path) as PatchRow | undefined;
    if (!patch) return;

    const updatedPatch = {
      path: patch.path,
      name: updates.name ?? patch.name,
      loved: updates.loved !== undefined ? (updates.loved ? 1 : 0) : patch.loved,
      category: updates.category ?? patch.category,
      tags: updates.tags ? JSON.stringify(updates.tags) : patch.tags,
      bank: updates.bank ?? patch.bank,
      library: updates.library ?? patch.library,
      checksum: patch.checksum,
      custom: updates.custom !== undefined ? (updates.custom ? 1 : 0) : patch.custom
    };

    const stmt = this.db.prepare(`
      UPDATE patches
      SET name = @name,
          loved = @loved,
          category = @category,
          tags = @tags,
          bank = @bank,
          library = @library,
          custom = @custom
      WHERE path = @path
    `);

    stmt.run(updatedPatch);
  }

  // Check if a patch with the given checksum exists
  patchExists(checksum: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM patches WHERE checksum = ?');
    return !!stmt.get(checksum);
  }

  // Delete a patch
  deletePatch(path: string): void {
    const stmt = this.db.prepare('DELETE FROM patches WHERE path = ?');
    stmt.run(path);
  }

  // Close the database connection
  close(): void {
    this.db.close();
  }
}

export const dbManager = new DatabaseManager();
export type { Patch, Bank };
export { calculateChecksum }; 