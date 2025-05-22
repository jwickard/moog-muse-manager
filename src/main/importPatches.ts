import path from 'path';
import fs from 'fs';
import { Patch, DatabaseManager, calculateChecksum } from './database';

export async function importPatchesFromDirectory(rootDir: string, libraryName: string, dbManager: DatabaseManager): Promise<Patch[]> {
  // If library/ exists, use it as the root
  const libraryPath = path.join(rootDir, 'library');
  if (fs.existsSync(libraryPath) && fs.statSync(libraryPath).isDirectory()) {
    rootDir = libraryPath;
  }

  const patches: Patch[] = [];
  // Get all directories that contain a .bank file
  const bankDirs = fs.readdirSync(rootDir)
    .filter(file => {
      const fullPath = path.join(rootDir, file);
      if (!fs.statSync(fullPath).isDirectory()) return false;
      const contents = fs.readdirSync(fullPath);
      return contents.some(f => f.endsWith('.bank'));
    })
    .sort(); // Sort to ensure consistent order

  for (const bankDir of bankDirs) {
    const bankPath = path.join(rootDir, bankDir);
    // Get the bank name from the .bank file instead of the directory
    const bankFiles = fs.readdirSync(bankPath).filter(f => f.endsWith('.bank'));
    if (bankFiles.length === 0) {
      continue;
    }
    const bankName = bankFiles[0].replace('.bank', '');
    const isCustom = bankName.toLowerCase().startsWith('user');

    // Create or get bank
    dbManager.saveBank({
      name: bankName,
      library: libraryName,
      custom: isCustom
    });

    const patchDirs = fs.readdirSync(bankPath)
      .filter(file => fs.statSync(path.join(bankPath, file)).isDirectory())
      .filter(dir => dir.startsWith('patch'));

    for (const patchDir of patchDirs) {
      const patchPath = path.join(bankPath, patchDir);
      const patchFiles = fs.readdirSync(patchPath)
        .filter(file => file.endsWith('.mmp'));

      for (const patchFile of patchFiles) {
        const fullPath = path.join(patchPath, patchFile);
        const checksum = calculateChecksum(fullPath);
        // Skip if patch already exists
        if (dbManager.patchExists(checksum)) {
          continue;
        }
        const patch = {
          path: fullPath,
          name: path.basename(patchFile, '.mmp'),
          loved: false,
          category: '',
          tags: [bankName],
          bank: bankName,
          library: libraryName,
          checksum,
          custom: isCustom
        };
        patches.push(patch);
      }
    }
  }

  // Save patches to database
  if (patches.length > 0) {
    dbManager.savePatches(patches);
    // Associate patches with their banks after saving
    for (const patch of patches) {
      const banks = dbManager.loadBanks().filter(b => b.name === patch.bank && b.library === patch.library);
      if (banks.length > 0) {
        dbManager.associatePatchWithBank?.(patch.path, banks[0].id!);
      }
    }
  }

  return patches;
} 