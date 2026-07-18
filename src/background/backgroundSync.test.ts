/**
 * Tests for the background service worker's sync -> local pull.
 *
 * Previously, data from sync storage was only ever pulled into local storage
 * on initial load / the one-time "enable sync" migration. These tests cover
 * syncRemoteToLocalStorage(), which pulls continuously (on an interval and
 * whenever sync storage changes) and must never drop an existing local page.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Page, SettingsV3Meta } from '../utils/settings';

const createMockArea = (initial: Record<string, any> = {}) => {
  const store: Record<string, any> = { ...initial };

  return {
    store,
    get: vi.fn(async (key?: string | string[] | null) => {
      if (key === undefined || key === null) return { ...store };
      if (typeof key === 'string') return { [key]: store[key] };
      const result: Record<string, any> = {};
      key.forEach((k) => {
        result[k] = store[k];
      });
      return result;
    }),
    set: vi.fn(async (data: Record<string, any>) => {
      Object.assign(store, data);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      arr.forEach((k) => delete store[k]);
    }),
    clear: vi.fn(async () => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  };
};

type MockArea = ReturnType<typeof createMockArea>;

const browserMock = vi.hoisted(() => ({
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  declarativeNetRequest: {
    getDynamicRules: vi.fn().mockResolvedValue([]),
    updateDynamicRules: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('webextension-polyfill', () => ({
  default: browserMock,
  ...browserMock,
}));

import { syncRemoteToLocalStorage } from './background';
import { PAGE_KEY_PREFIX, SETTINGS_V3_META_KEY, SYNC_ENABLED_KEY } from '../constants';

const createPage = (id: number, name: string, headerValue = 'value'): Page => ({
  id,
  name,
  enabled: id === 0,
  keepEnabled: false,
  showHeaderComments: true,
  filtersExpanded: true,
  filters: [],
  headers: [
    {
      id: `${id}-1`,
      headerName: 'X-Test',
      headerValue,
      headerComment: '',
      headerEnabled: true,
      headerType: 'request',
    },
  ],
});

const seedArea = (area: MockArea, pages: Page[], selectedPage = 0) => {
  const meta: SettingsV3Meta = { version: 3, selectedPage, pageCount: pages.length };
  area.store[SETTINGS_V3_META_KEY] = meta;
  pages.forEach((page, index) => {
    area.store[`${PAGE_KEY_PREFIX}${index}`] = page;
  });
};

const readLocalPages = (area: MockArea): Page[] => {
  const meta = area.store[SETTINGS_V3_META_KEY] as SettingsV3Meta;
  const pages: Page[] = [];
  for (let i = 0; i < meta.pageCount; i++) {
    pages.push(area.store[`${PAGE_KEY_PREFIX}${i}`]);
  }
  return pages;
};

describe('syncRemoteToLocalStorage', () => {
  let localArea: MockArea;
  let syncArea: MockArea;

  beforeEach(() => {
    vi.clearAllMocks();
    localArea = createMockArea();
    syncArea = createMockArea();

    // Wire the shared browser.storage mock to whichever area this test seeded
    browserMock.storage.local.get.mockImplementation(localArea.get);
    browserMock.storage.local.set.mockImplementation(localArea.set);
    browserMock.storage.local.remove.mockImplementation(localArea.remove);
    browserMock.storage.sync.get.mockImplementation(syncArea.get);
    browserMock.storage.sync.set.mockImplementation(syncArea.set);
    browserMock.storage.sync.remove.mockImplementation(syncArea.remove);
  });

  it('does nothing when sync is disabled', async () => {
    localArea.store[SYNC_ENABLED_KEY] = false;
    seedArea(localArea, [createPage(0, 'Local Page')]);
    seedArea(syncArea, [createPage(0, 'Local Page'), createPage(1, 'Remote Page', 'other')]);

    await syncRemoteToLocalStorage();

    expect(readLocalPages(localArea)).toHaveLength(1);
  });

  it('does nothing when sync storage has no pages', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [createPage(0, 'Local Page')]);

    await syncRemoteToLocalStorage();

    expect(readLocalPages(localArea)).toHaveLength(1);
    expect(localArea.set).not.toHaveBeenCalled();
  });

  it('bootstraps local storage from sync when local has no settings yet', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(syncArea, [createPage(0, 'Remote Page A'), createPage(1, 'Remote Page B', 'other')], 1);

    await syncRemoteToLocalStorage();

    const pages = readLocalPages(localArea);
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.name)).toEqual(['Remote Page A', 'Remote Page B']);
    const meta = localArea.store[SETTINGS_V3_META_KEY] as SettingsV3Meta;
    expect(meta.selectedPage).toBe(1);
  });

  it('merges new pages from sync without dropping existing local pages', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [createPage(0, 'My Local Page', 'local-value')], 0);
    seedArea(syncArea, [
      createPage(0, 'My Local Page', 'local-value'), // same content as local -> should dedupe
      createPage(1, 'Other Browser Page', 'other-value'), // new -> should be appended
    ]);

    await syncRemoteToLocalStorage();

    const pages = readLocalPages(localArea);
    expect(pages).toHaveLength(2);
    expect(pages[0].name).toBe('My Local Page');
    expect(pages[0].enabled).toBe(true); // local page's state untouched
    expect(pages[1].name).toBe('Other Browser Page');
    expect(pages[1].enabled).toBe(false); // merged-in page starts disabled

    const meta = localArea.store[SETTINGS_V3_META_KEY] as SettingsV3Meta;
    expect(meta.selectedPage).toBe(0); // local selection preserved, not overwritten by sync
  });

  it('is a no-op when local already has everything sync has', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    const pages = [createPage(0, 'Page A'), createPage(1, 'Page B', 'b-value')];
    seedArea(localArea, pages, 1);
    seedArea(syncArea, pages, 0);

    await syncRemoteToLocalStorage();

    expect(localArea.set).not.toHaveBeenCalled();
    const meta = localArea.store[SETTINGS_V3_META_KEY] as SettingsV3Meta;
    expect(meta.selectedPage).toBe(1); // untouched
  });
});
