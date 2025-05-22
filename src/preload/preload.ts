import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // Add your IPC methods here
    // Example:
    // loadLibrary: () => ipcRenderer.invoke('load-library'),
    // saveMetadata: (data: any) => ipcRenderer.invoke('save-metadata', data),
  }
)

interface Patch {
  path: string;
  name: string;
  loved: boolean;
  category: string;
  tags: string[];
  bank: string;
  library: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  importPatches: () => ipcRenderer.invoke('import-patches') as Promise<Patch[]>,
  exportPatches: (patches: string[]) => ipcRenderer.invoke('export-patches', patches),
  loadPatches: () => ipcRenderer.invoke('load-patches') as Promise<Patch[]>,
  updatePatch: (path: string, updates: Partial<Patch>) => ipcRenderer.invoke('update-patch', path, updates)
}) 