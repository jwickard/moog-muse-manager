import React, { useState, useEffect } from 'react'
import path from 'path'

// Define the type for the window object with our electron API
declare global {
  interface Window {
    electronAPI: {
      importPatches: () => Promise<{ path: string; bank: string; library: string }[]>;
      exportPatches: (patches: string[]) => Promise<boolean>;
      loadPatches: () => Promise<Patch[]>;
      updatePatch: (path: string, updates: Partial<Patch>) => Promise<boolean>;
    }
  }
}

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

// Helper function to capitalize first letter of each word
const capitalizeWords = (str: string): string => {
  return str
    .split(/[-_\s]/) // Split by hyphen, underscore, or space
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const App: React.FC = () => {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [filter, setFilter] = useState({ 
    loved: false, 
    category: '', 
    tag: '',
    bank: '',
    library: '',
    custom: false
  });
  const [categories, setCategories] = useState<string[]>(['Bass', 'Lead', 'Pad', 'Pluck', 'Strings']);

  // Load saved patches when component mounts
  useEffect(() => {
    const loadSavedPatches = async () => {
      try {
        const savedPatches = await window.electronAPI.loadPatches();
        console.log('Loaded patches from database:', savedPatches);
        console.log('Patches with custom flag:', savedPatches.filter(p => p.custom).length);
        setPatches(savedPatches);
        
        // Update categories based on saved patches
        const uniqueCategories = new Set([
          ...categories,
          ...savedPatches.map(patch => patch.category).filter(Boolean)
        ]);
        setCategories(Array.from(uniqueCategories));
      } catch (error) {
        console.error('Error loading saved patches:', error);
      }
    };

    loadSavedPatches();
  }, []);

  const handleImportPatches = async () => {
    try {
      console.log('Starting import...');
      await window.electronAPI.importPatches();
      console.log('Import completed, reloading patches...');
      
      // Reload all patches from the database
      const allPatches = await window.electronAPI.loadPatches();
      console.log('Loaded patches:', allPatches);
      
      // Update categories based on all patches
      const newCategories = new Set([
        ...categories,
        ...allPatches.map(patch => patch.category).filter(Boolean)
      ]);
      setCategories(Array.from(newCategories));
      
      // Update patches state with all patches
      setPatches(allPatches);
    } catch (error) {
      console.error('Error importing patches:', error);
    }
  };

  const handleFilterChange = async (key: string, value: boolean | string) => {
    const newFilter = { ...filter, [key]: value };
    setFilter(newFilter);

    // Check if all filters are cleared
    const allFiltersCleared = Object.entries(newFilter).every(([k, v]) => {
      if (typeof v === 'boolean') return !v;
      return v === '';
    });

    if (allFiltersCleared) {
      console.log('All filters cleared, reloading patches from database...');
      try {
        const savedPatches = await window.electronAPI.loadPatches();
        console.log('Loaded patches from database:', savedPatches);
        setPatches(savedPatches);
      } catch (error) {
        console.error('Error reloading patches:', error);
      }
    }
  };

  const handlePatchEdit = async (index: number, key: string, value: boolean | string | string[]) => {
    const updatedPatches = [...patches];
    const patch = updatedPatches[index];
    const updates = { [key]: value };
    
    // Update local state
    updatedPatches[index] = { ...patch, ...updates };
    setPatches(updatedPatches);

    // Persist changes to database
    try {
      await window.electronAPI.updatePatch(patch.path, updates);
    } catch (error) {
      console.error('Error updating patch:', error);
    }
  };

  const handleExportPatches = async () => {
    try {
      const paths = patches.map(patch => patch.path);
      await window.electronAPI.exportPatches(paths);
      console.log('Patches exported successfully.');
    } catch (error) {
      console.error('Error exporting patches:', error);
    }
  };

  const filteredPatches = patches.filter(patch => {
    const isLoved = filter.loved ? patch.loved : true;
    const matchesCategory = filter.category ? patch.category === filter.category : true;
    const matchesTag = filter.tag ? patch.tags.includes(filter.tag) : true;
    const matchesBank = filter.bank ? patch.bank === filter.bank : true;
    const matchesLibrary = filter.library ? patch.library === filter.library : true;
    const matchesCustom = filter.custom ? patch.custom : true;
    
    if (filter.custom) {
      console.log(`Patch ${patch.name} custom status:`, {
        isCustom: patch.custom,
        matchesCustom,
        filterCustom: filter.custom
      });
    }
    
    return isLoved && matchesCategory && matchesTag && matchesBank && matchesLibrary && matchesCustom;
  });

  // Get unique banks and libraries for filter dropdowns
  const uniqueBanks = Array.from(new Set(patches.map(patch => patch.bank))).sort();
  const uniqueLibraries = Array.from(new Set(patches.map(patch => patch.library))).sort();

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Moog Muse Manager
          </h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <button
            onClick={handleImportPatches}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Import Patches
          </button>
          <button
            onClick={handleExportPatches}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-2"
          >
            Export Patches
          </button>
          <div className="mt-4">
            <h2 className="text-xl font-semibold">Filter Patches</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <label className="flex items-center space-x-2">
                <input
                  id="loved-filter"
                  className="h-4 w-4 text-blue-600"
                  type="checkbox"
                  checked={filter.loved}
                  onChange={(e) => handleFilterChange('loved', e.target.checked)}
                />
                <span>Loved</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  id="custom-filter"
                  className="h-4 w-4 text-green-600"
                  type="checkbox"
                  checked={filter.custom}
                  onChange={(e) => handleFilterChange('custom', e.target.checked)}
                />
                <span>Custom</span>
              </label>
              <div>
                <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  id="category-filter"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={filter.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bank-filter" className="block text-sm font-medium text-gray-700">
                  Bank
                </label>
                <select
                  id="bank-filter"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={filter.bank}
                  onChange={(e) => handleFilterChange('bank', e.target.value)}
                >
                  <option value="">All Banks</option>
                  {uniqueBanks.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="library-filter" className="block text-sm font-medium text-gray-700">
                  Library
                </label>
                <select
                  id="library-filter"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={filter.library}
                  onChange={(e) => handleFilterChange('library', e.target.value)}
                >
                  <option value="">All Libraries</option>
                  {uniqueLibraries.map((lib) => (
                    <option key={lib} value={lib}>{lib}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tags-filter" className="block text-sm font-medium text-gray-700">
                  Tags
                </label>
                <input
                  id="tags-filter"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  type="text"
                  placeholder="Filter by tag"
                  value={filter.tag}
                  onChange={(e) => handleFilterChange('tag', e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-xl font-semibold">Imported Patches</h2>
            <ul className="mt-2 space-y-2">
              {filteredPatches.map((patch, index) => (
                <li key={index} className="bg-white p-4 rounded shadow">
                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      checked={patch.loved}
                      onChange={(e) => handlePatchEdit(index, 'loved', e.target.checked)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="font-medium text-gray-900 min-w-[200px]">{patch.name}</span>
                    <span className="text-gray-500 min-w-[100px]">Bank: {patch.bank}</span>
                    <span className="text-gray-500 min-w-[100px]">Library: {patch.library}</span>
                    {patch.custom && (
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        Custom
                      </span>
                    )}
                    <select
                      value={patch.category}
                      onChange={(e) => handlePatchEdit(index, 'category', e.target.value)}
                      className="border rounded px-2 py-1"
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Add tags"
                      value={patch.tags.join(', ')}
                      onChange={(e) => handlePatchEdit(index, 'tags', e.target.value.split(',').map(tag => tag.trim()))}
                      className="border rounded px-2 py-1 flex-grow"
                    />
                    <span className="text-gray-500 text-xs font-mono">{patch.checksum}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App 