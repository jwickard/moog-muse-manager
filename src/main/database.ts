import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import crypto from 'crypto';

export interface Patch {
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

export interface Bank {
  id?: number;
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

export class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(app.getPath('userData'), 'patches.db');
    const finalPath = dbPath || defaultPath;
    
    // Ensure the directory exists
    const dbDir = path.dirname(finalPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(finalPath);
    this.setupDatabase();
  }

  private setupDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patches (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        loved INTEGER NOT NULL DEFAULT 0,
        category TEXT,
        tags TEXT,
        bank TEXT,
        library TEXT,
        checksum TEXT UNIQUE,
        custom INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        library TEXT NOT NULL,
        custom INTEGER NOT NULL DEFAULT 0,
        UNIQUE(name, library)
      );

      CREATE TABLE IF NOT EXISTS patch_banks (
        patch_path TEXT,
        bank_id INTEGER,
        FOREIGN KEY (patch_path) REFERENCES patches(path) ON DELETE CASCADE,
        FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE,
        PRIMARY KEY (patch_path, bank_id)
      );
    `);
  }

  public savePatch(patch: Patch): void {
    if (this.patchExists(patch.checksum)) {
      return; // Skip saving if a patch with the same checksum exists
    }

    const stmt = this.db.prepare(`
      INSERT INTO patches (path, name, loved, category, tags, bank, library, checksum, custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      patch.path,
      patch.name,
      patch.loved ? 1 : 0,
      patch.category,
      JSON.stringify(patch.tags),
      patch.bank,
      patch.library,
      patch.checksum,
      patch.custom ? 1 : 0
    );
  }

  public savePatches(patches: Patch[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO patches (path, name, loved, category, tags, bank, library, checksum, custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((patches: Patch[]) => {
      for (const patch of patches) {
        if (!this.patchExists(patch.checksum)) {
          stmt.run(
            patch.path,
            patch.name,
            patch.loved ? 1 : 0,
            patch.category,
            JSON.stringify(patch.tags),
            patch.bank,
            patch.library,
            patch.checksum,
            patch.custom ? 1 : 0
          );
        }
      }
    });

    insertMany(patches);
  }

  public loadPatches(): Patch[] {
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

  public saveBank(bank: Bank): number {
    // First check if the bank already exists
    const existingBank = this.db.prepare(`
      SELECT id FROM banks 
      WHERE name = ? AND library = ? AND custom = ?
    `).get(bank.name, bank.library, bank.custom ? 1 : 0) as { id: number } | undefined;

    if (existingBank) {
      return existingBank.id;
    }

    // If bank doesn't exist, insert it
    const stmt = this.db.prepare(`
      INSERT INTO banks (name, library, custom)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(bank.name, bank.library, bank.custom ? 1 : 0);
    return result.lastInsertRowid as number;
  }

  public loadBanks(): Bank[] {
    const stmt = this.db.prepare('SELECT * FROM banks');
    const rows = stmt.all() as BankRow[];
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      library: row.library,
      custom: Boolean(row.custom)
    }));
  }

  public getPatchesForBank(bankId: number): Patch[] {
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

  public updatePatchMetadata(path: string, updates: Partial<Patch>): void {
    const patch = this.db.prepare('SELECT * FROM patches WHERE path = ?').get(path) as PatchRow | undefined;
    if (!patch) return;

    const updatedPatch = {
      ...patch,
      ...updates,
      loved: updates.loved !== undefined ? (updates.loved ? 1 : 0) : patch.loved,
      tags: updates.tags ? JSON.stringify(updates.tags) : patch.tags,
      custom: updates.custom !== undefined ? (updates.custom ? 1 : 0) : patch.custom
    };

    const stmt = this.db.prepare(`
      UPDATE patches
      SET name = ?,
          loved = ?,
          category = ?,
          tags = ?,
          bank = ?,
          library = ?,
          checksum = ?,
          custom = ?
      WHERE path = ?
    `);

    stmt.run(
      updatedPatch.name,
      updatedPatch.loved,
      updatedPatch.category,
      updatedPatch.tags,
      updatedPatch.bank,
      updatedPatch.library,
      updatedPatch.checksum,
      updatedPatch.custom,
      path
    );
  }

  public patchExists(checksum: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM patches WHERE checksum = ?');
    return Boolean(stmt.get(checksum));
  }

  public close(): void {
    this.db.close();
  }

  public getBank(name: string, library: string): Bank | undefined {
    const stmt = this.db.prepare('SELECT * FROM banks WHERE name = ? AND library = ?');
    const row = stmt.get(name, library) as BankRow | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      library: row.library,
      custom: Boolean(row.custom)
    };
  }

  public associatePatchWithBank(patchPath: string, bankId: number): void {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO patch_banks (patch_path, bank_id) VALUES (?, ?)');
    stmt.run(patchPath, bankId);
  }
}

// Replace the global dbManager export with a lazy-loaded getDbManager function
let _dbManager: DatabaseManager | null = null;

export function getDbManager(): DatabaseManager {
  if (!_dbManager) {
    _dbManager = new DatabaseManager();
  }
  return _dbManager;
}

export { calculateChecksum }; 