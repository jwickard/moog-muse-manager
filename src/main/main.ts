import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { dbManager, Patch, calculateChecksum } from './database'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // and load the index.html of the app.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC handler for importing patches
ipcMain.handle('import-patches', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })

  console.log('Selected directory:', filePaths[0])

  if (filePaths.length === 0) {
    return []
  }

  let rootDir = filePaths[0]
  const libraryName = path.basename(rootDir)
  // If Library/ exists, use it as the root
  const libraryPath = path.join(rootDir, 'Library')
  if (fs.existsSync(libraryPath) && fs.statSync(libraryPath).isDirectory()) {
    rootDir = libraryPath
    console.log('Using Library/ as root directory:', rootDir)
  }

  const patches: Patch[] = []
  // Get all directories that contain a .bank file
  const bankDirs = fs.readdirSync(rootDir)
    .filter(file => {
      const fullPath = path.join(rootDir, file)
      if (!fs.statSync(fullPath).isDirectory()) return false
      const contents = fs.readdirSync(fullPath)
      return contents.some(f => f.endsWith('.bank'))
    })
    .sort() // Sort to ensure consistent order

  console.log('Found bank directories:', bankDirs)

  for (const bankDir of bankDirs) {
    const bankPath = path.join(rootDir, bankDir)
    // Get the bank name from the .bank file instead of the directory
    const bankFiles = fs.readdirSync(bankPath).filter(f => f.endsWith('.bank'))
    if (bankFiles.length === 0) {
      console.log(`No .bank file found in ${bankDir}, skipping...`)
      continue
    }
    const bankName = bankFiles[0].replace('.bank', '')
    const isCustom = bankName.toLowerCase().startsWith('user')
    console.log('Processing bank:', bankName, 'Is custom:', isCustom)

    // Create or get bank
    dbManager.saveBank({
      name: bankName,
      library: libraryName,
      custom: isCustom
    })

    const patchDirs = fs.readdirSync(bankPath)
      .filter(file => fs.statSync(path.join(bankPath, file)).isDirectory())
      .filter(dir => dir.startsWith('patch'))

    for (const patchDir of patchDirs) {
      const patchPath = path.join(bankPath, patchDir)
      const patchFiles = fs.readdirSync(patchPath)
        .filter(file => file.endsWith('.mmp'))

      for (const patchFile of patchFiles) {
        const fullPath = path.join(patchPath, patchFile)
        const checksum = calculateChecksum(fullPath)
        
        // Skip if patch already exists
        if (dbManager.patchExists(checksum)) {
          console.log(`Skipping duplicate patch: ${patchFile}`)
          continue
        }

        console.log(`Creating patch for ${patchFile} in bank ${bankName}, custom: ${isCustom}`)
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
        }
        console.log('Created patch object:', JSON.stringify(patch, null, 2))
        patches.push(patch)
      }
    }
  }

  console.log('Total new patches found:', patches.length)
  console.log('Patches with custom flag:', patches.filter(p => p.custom).length)
  
  // Save patches to database
  if (patches.length > 0) {
    console.log('Saving patches to database...')
    dbManager.savePatches(patches)
    console.log('Patches saved to database')

    // Associate patches with their banks after saving
    for (const patch of patches) {
      const bank = dbManager.getBank(patch.bank, patch.library)
      if (bank) {
        dbManager.associatePatchWithBank(patch.path, bank.id)
      }
    }
  }
  
  return patches
})

// Add new IPC handler for loading banks
ipcMain.handle('load-banks', () => {
  return dbManager.loadBanks()
})

// Add new IPC handler for getting patches by bank
ipcMain.handle('get-patches-for-bank', (_, bankId: number) => {
  return dbManager.getPatchesForBank(bankId)
})

// IPC handler for loading saved patches
ipcMain.handle('load-patches', () => {
  return dbManager.loadPatches()
})

// IPC handler for updating patch metadata
ipcMain.handle('update-patch', (_, path: string, updates: Partial<Patch>) => {
  dbManager.updatePatchMetadata(path, updates)
  return true
})

// IPC handler for exporting patches
ipcMain.handle('export-patches', async (_, patches: string[]) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Patches',
    defaultPath: path.join(app.getPath('documents'), 'exported-patches'),
    buttonLabel: 'Export',
  })

  if (!filePath) {
    return
  }

  const exportDirectory = path.dirname(filePath)
  if (!fs.existsSync(exportDirectory)) {
    fs.mkdirSync(exportDirectory, { recursive: true })
  }

  patches.forEach((patch: string, index: number) => {
    const patchDir = path.join(exportDirectory, `bank${index.toString().padStart(2, '0')}`)
    if (!fs.existsSync(patchDir)) {
      fs.mkdirSync(patchDir, { recursive: true })
    }
    const patchFile = path.join(patchDir, `patch${index.toString().padStart(2, '0')}.mmp`)
    fs.copyFileSync(patch, patchFile)
  })

  return true
})

// Clean up database connection when app quits
app.on('before-quit', () => {
  dbManager.close()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here. 