/**
 * Tests for storage utility functions
 * 
 * These tests mock the browser storage API to test various scenarios:
 * - New users with no existing data
 * - Existing users with single extension instance
 * - Existing users with multiple extension instances (sync scenarios)
 */

import { vi } from 'vitest';

// Create mock storage data - must be declared before vi.mock
let mockLocalData: Record<string, any> = {};
let mockSyncData: Record<string, any> = {};

// Mock the entire webextension-polyfill module BEFORE any imports.
// Vitest factory mocks need a `default` export when the consumer imports
// the module via a default import.
vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
        clear: vi.fn(),
        remove: vi.fn(),
      },
      sync: {
        get: vi.fn(),
        set: vi.fn(),
        clear: vi.fn(),
        remove: vi.fn(),
      },
    },
  },
}));

import browser from 'webextension-polyfill';
import { 
  loadFromStorage, 
  clearStorage, 
  getDataSizeInBytes, 
  hasEnoughStorageSpace 
} from './storage';

// Setup mocks before each test
beforeEach(() => {
  mockLocalData = {};
  mockSyncData = {};
  
  // Mock local storage
  (browser.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation((key: string | null) => {
    if (key === null) {
      return Promise.resolve({ ...mockLocalData });
    }
    return Promise.resolve({ [key]: mockLocalData[key] });
  });
  
  (browser.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation((data: Record<string, any>) => {
    Object.assign(mockLocalData, data);
    return Promise.resolve();
  });
  
  (browser.storage.local.clear as ReturnType<typeof vi.fn>).mockImplementation(() => {
    mockLocalData = {};
    return Promise.resolve();
  });
  
  // Mock sync storage
  (browser.storage.sync.get as ReturnType<typeof vi.fn>).mockImplementation((key: string | null) => {
    if (key === null) {
      return Promise.resolve({ ...mockSyncData });
    }
    return Promise.resolve({ [key]: mockSyncData[key] });
  });
  
  (browser.storage.sync.set as ReturnType<typeof vi.fn>).mockImplementation((data: Record<string, any>) => {
    Object.assign(mockSyncData, data);
    return Promise.resolve();
  });
  
  (browser.storage.sync.clear as ReturnType<typeof vi.fn>).mockImplementation(() => {
    mockSyncData = {};
    return Promise.resolve();
  });
});

describe('Storage Utilities', () => {
  describe('loadFromStorage', () => {
    it('should load data from local storage first', async () => {
      mockLocalData['testKey'] = { local: true };
      mockSyncData['testKey'] = { sync: true };
      
      const result = await loadFromStorage('testKey', null);
      
      expect(result).toEqual({ local: true });
    });

    it('should fall back to sync storage when local is empty', async () => {
      mockSyncData['testKey'] = { sync: true };
      
      const result = await loadFromStorage('testKey', null, ['local', 'sync']);
      
      expect(result).toEqual({ sync: true });
    });

    it('should return default value when key not found in any storage', async () => {
      const defaultValue = { default: true };
      
      const result = await loadFromStorage('nonExistentKey', defaultValue);
      
      expect(result).toEqual(defaultValue);
    });

    it('should respect custom storage type order', async () => {
      mockLocalData['testKey'] = { local: true };
      mockSyncData['testKey'] = { sync: true };
      
      const result = await loadFromStorage('testKey', null, ['sync', 'local']);
      
      expect(result).toEqual({ sync: true });
    });
  });

  describe('clearStorage', () => {
    it('should clear local storage only when specified', async () => {
      mockLocalData['key1'] = 'value1';
      mockSyncData['key2'] = 'value2';
      
      await clearStorage('local');
      
      expect(browser.storage.local.clear).toHaveBeenCalled();
    });

    it('should clear sync storage only when specified', async () => {
      mockLocalData['key1'] = 'value1';
      mockSyncData['key2'] = 'value2';
      
      await clearStorage('sync');
      
      expect(browser.storage.sync.clear).toHaveBeenCalled();
    });

    it('should clear both storages when specified', async () => {
      mockLocalData['key1'] = 'value1';
      mockSyncData['key2'] = 'value2';
      
      await clearStorage('both');
      
      expect(browser.storage.local.clear).toHaveBeenCalled();
      expect(browser.storage.sync.clear).toHaveBeenCalled();
    });
  });

  describe('getDataSizeInBytes', () => {
    it('should return correct size for simple objects', () => {
      const data = { name: 'test' };
      const size = getDataSizeInBytes(data);
      
      expect(size).toBe(new TextEncoder().encode(JSON.stringify(data)).length);
    });

    it('should return correct size for complex objects', () => {
      const data = {
        pages: [
          { id: 1, name: 'Page 1', headers: [{ name: 'X-Test', value: 'value' }] },
          { id: 2, name: 'Page 2', headers: [] },
        ],
      };
      const size = getDataSizeInBytes(data);
      
      expect(size).toBeGreaterThan(0);
      expect(size).toBe(new TextEncoder().encode(JSON.stringify(data)).length);
    });
  });

  describe('hasEnoughStorageSpace', () => {
    it('should return true for small data in local storage', () => {
      const smallData = { name: 'test' };
      
      expect(hasEnoughStorageSpace(smallData, 'local')).toBe(true);
    });

    it('should return true for data under sync limit', () => {
      const data = { data: 'x'.repeat(7000) }; // Just under 8KB
      
      expect(hasEnoughStorageSpace(data, 'sync')).toBe(true);
    });

    it('should return false for data over sync limit', () => {
      const data = { data: 'x'.repeat(9000) }; // Over 8KB
      
      expect(hasEnoughStorageSpace(data, 'sync')).toBe(false);
    });
  });
});

describe('Storage Scenarios', () => {
  describe('New User Scenario', () => {
    it('should return default settings when no data exists', async () => {
      const defaultSettings = { pages: [], selectedPage: 0 };
      
      const result = await loadFromStorage('settings', defaultSettings);
      
      expect(result).toEqual(defaultSettings);
    });
  });

  describe('Existing Single Instance Scenario', () => {
    it('should load existing local settings correctly', async () => {
      const existingSettings = {
        pages: [
          { id: 0, name: 'Page 1', enabled: true, headers: [], filters: [] },
          { id: 1, name: 'Page 2', enabled: false, headers: [], filters: [] },
        ],
        selectedPage: 0,
      };
      mockLocalData['settings'] = existingSettings;
      
      const result = await loadFromStorage('settings', { pages: [], selectedPage: 0 });
      
      expect(result).toEqual(existingSettings);
    });
  });

  describe('Multiple Instance (Sync) Scenario', () => {
    it('should prefer local storage over sync storage', async () => {
      type SettingsType = { pages: Array<{ id: number; name: string; enabled: boolean; headers: never[]; filters: never[] }>; selectedPage: number };
      const localSettings: SettingsType = {
        pages: [{ id: 0, name: 'Local Page', enabled: true, headers: [], filters: [] }],
        selectedPage: 0,
      };
      const syncSettings: SettingsType = {
        pages: [{ id: 0, name: 'Sync Page', enabled: true, headers: [], filters: [] }],
        selectedPage: 0,
      };
      mockLocalData['settings'] = localSettings;
      mockSyncData['settings'] = syncSettings;
      
      const result = await loadFromStorage<SettingsType>('settings', { pages: [], selectedPage: 0 }, ['local', 'sync']);
      
      expect(result.pages[0].name).toBe('Local Page');
    });

    it('should fall back to sync storage when local is empty', async () => {
      type SettingsType = { pages: Array<{ id: number; name: string; enabled: boolean; headers: never[]; filters: never[] }>; selectedPage: number };
      const syncSettings: SettingsType = {
        pages: [{ id: 0, name: 'Sync Page', enabled: true, headers: [], filters: [] }],
        selectedPage: 0,
      };
      mockSyncData['settings'] = syncSettings;
      
      const result = await loadFromStorage<SettingsType>('settings', { pages: [], selectedPage: 0 }, ['local', 'sync']);
      
      expect(result.pages[0].name).toBe('Sync Page');
    });

    it('should handle sync enabled/disabled preference correctly', async () => {
      // Initially sync is disabled
      mockLocalData['syncEnabled'] = false;
      
      let syncEnabled = await loadFromStorage('syncEnabled', false, ['local']);
      expect(syncEnabled).toBe(false);
      
      // Simulate enabling sync by directly updating mock storage
      mockLocalData['syncEnabled'] = true;
      
      syncEnabled = await loadFromStorage('syncEnabled', false, ['local']);
      expect(syncEnabled).toBe(true);
    });

    it('should track migration completion correctly', async () => {
      // Initially migration is not complete
      let migrationComplete = await loadFromStorage('migrationComplete', false, ['local']);
      expect(migrationComplete).toBe(false);
      
      // Simulate marking migration as complete
      mockLocalData['migrationComplete'] = true;
      
      migrationComplete = await loadFromStorage('migrationComplete', false, ['local']);
      expect(migrationComplete).toBe(true);
    });
  });
});
