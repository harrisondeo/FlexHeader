/**
 * syncRemoteToLocalStorage() pulls continuously (interval + storage.sync
 * onChanged), replacing the old load-only/one-time-migration pull - these
 * tests guard that it can never drop an existing local page.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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

import { syncRemoteToLocalStorage, syncLocalToRemoteStorage, initBackground } from './background';
import { PAGE_KEY_PREFIX, SETTINGS_V3_META_KEY, PAGE_TOMBSTONES_KEY, SYNC_ENABLED_KEY, LAST_MERGE_TIME_KEY, SELECTED_PAGE_KEY, SETTINGS_SAVE_DEBOUNCE_TIME } from '../constants';
import type { PageTombstone } from '../utils/domain/pageMerge';

const createPage = (
  id: number,
  name: string,
  headerValue = 'value',
  identity?: { pageId: string; lastModified: number }
): Page => ({
  id,
  name,
  enabled: id === 0,
  keepEnabled: false,
  showHeaderComments: true,
  filters: [],
  ...identity,
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

const seedTombstones = (area: MockArea, tombstones: PageTombstone[]) => {
  area.store[PAGE_TOMBSTONES_KEY] = tombstones;
};

const readTombstones = (area: MockArea): PageTombstone[] => area.store[PAGE_TOMBSTONES_KEY] ?? [];

describe('syncRemoteToLocalStorage', () => {
  let localArea: MockArea;
  let syncArea: MockArea;

  beforeEach(() => {
    vi.clearAllMocks();
    localArea = createMockArea();
    syncArea = createMockArea();

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

  it('updates an existing page in place instead of forking a duplicate when its header value was edited elsewhere', async () => {
    // Regression test: the old content-based dedup key changed along with
    // the edited value, so this used to fork a duplicate instead of updating.
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [
      createPage(0, 'Shared Page', 'old-value', { pageId: 'shared-1', lastModified: 1000 }),
    ], 0);
    seedArea(syncArea, [
      createPage(0, 'Shared Page', 'new-value', { pageId: 'shared-1', lastModified: 2000 }),
    ], 0);

    await syncRemoteToLocalStorage();

    const pages = readLocalPages(localArea);
    expect(pages).toHaveLength(1); // no duplicate page created
    expect(pages[0].headers[0].headerValue).toBe('new-value');
    expect(pages[0].enabled).toBe(true); // local enabled/selection state preserved

    expect(localArea.store[LAST_MERGE_TIME_KEY]).toBeDefined();
  });

  it('does not overwrite a local edit with a stale remote version of the same page', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [
      createPage(0, 'Shared Page', 'newer-value', { pageId: 'shared-1', lastModified: 5000 }),
    ], 0);
    seedArea(syncArea, [
      createPage(0, 'Shared Page', 'stale-value', { pageId: 'shared-1', lastModified: 1000 }),
    ], 0);

    await syncRemoteToLocalStorage();

    const pages = readLocalPages(localArea);
    expect(pages).toHaveLength(1);
    expect(pages[0].headers[0].headerValue).toBe('newer-value');
    expect(localArea.set).not.toHaveBeenCalled();
  });

  it('does not resurrect a page deleted locally when the pull runs before the delete has been pushed', async () => {
    // The exact reported bug: the periodic tick pulls before it pushes, so a
    // local delete can see sync storage's still-larger, pre-delete page set.
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [
      createPage(0, 'Survivor', 'value', { pageId: 'page-1', lastModified: Date.now() - 60000 }),
    ], 0);
    seedTombstones(localArea, [{ pageId: 'page-2', deletedAt: Date.now() - 5000 }]);

    seedArea(syncArea, [
      createPage(0, 'Survivor', 'value', { pageId: 'page-1', lastModified: Date.now() - 60000 }),
      createPage(1, 'Deleted Page', 'value', { pageId: 'page-2', lastModified: Date.now() - 20000 }),
    ], 0);

    await syncRemoteToLocalStorage();

    const pages = readLocalPages(localArea);
    expect(pages).toHaveLength(1);
    expect(pages[0].pageId).toBe('page-1');
  });

  it('applies a remote tombstone to remove a page that only exists locally', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [
      createPage(0, 'Shared', 'value', { pageId: 'shared-1', lastModified: Date.now() - 20000 }),
    ], 0);
    seedArea(syncArea, [], 0);
    seedTombstones(syncArea, [{ pageId: 'shared-1', deletedAt: Date.now() - 5000 }]);

    await syncRemoteToLocalStorage();

    const pages = readLocalPages(localArea);
    expect(pages.map((p) => p.pageId)).not.toContain('shared-1');
  });

  it('lets a local edit override an older remote tombstone (resurrection)', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [
      createPage(0, 'Shared', 'edited-value', { pageId: 'shared-1', lastModified: Date.now() - 2000 }),
    ], 0);
    seedArea(syncArea, [], 0);
    seedTombstones(syncArea, [{ pageId: 'shared-1', deletedAt: Date.now() - 20000 }]);

    await syncRemoteToLocalStorage();

    const pages = readLocalPages(localArea);
    expect(pages.map((p) => p.pageId)).toContain('shared-1');
    expect(pages[0].headers[0].headerValue).toBe('edited-value');
  });

  it('lets a remote edit override an older local tombstone (resurrection from the other side)', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [
      createPage(0, 'Anchor', 'value', { pageId: 'anchor', lastModified: Date.now() - 60000 }),
    ], 0);
    seedTombstones(localArea, [{ pageId: 'shared-1', deletedAt: Date.now() - 20000 }]);

    seedArea(syncArea, [
      createPage(0, 'Anchor', 'value', { pageId: 'anchor', lastModified: Date.now() - 60000 }),
      createPage(1, 'Shared', 'edited-remotely', { pageId: 'shared-1', lastModified: Date.now() - 2000 }),
    ], 0);

    await syncRemoteToLocalStorage();

    const pages = readLocalPages(localArea);
    expect(pages.map((p) => p.pageId)).toContain('shared-1');
  });

  it('seeds local tombstones from sync when bootstrapping from empty local storage', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(syncArea, [createPage(0, 'Remote Page')], 0);
    seedTombstones(syncArea, [{ pageId: 'already-deleted', deletedAt: Date.now() - 5000 }]);

    await syncRemoteToLocalStorage();

    expect(readTombstones(localArea)).toHaveLength(1);
    expect(readTombstones(localArea)[0].pageId).toBe('already-deleted');
  });
});

describe('syncLocalToRemoteStorage', () => {
  let localArea: MockArea;
  let syncArea: MockArea;

  beforeEach(() => {
    vi.clearAllMocks();
    localArea = createMockArea();
    syncArea = createMockArea();

    browserMock.storage.local.get.mockImplementation(localArea.get);
    browserMock.storage.local.set.mockImplementation(localArea.set);
    browserMock.storage.local.remove.mockImplementation(localArea.remove);
    browserMock.storage.sync.get.mockImplementation(syncArea.get);
    browserMock.storage.sync.set.mockImplementation(syncArea.set);
    browserMock.storage.sync.remove.mockImplementation(syncArea.remove);
  });

  it('removes stale page_N keys from sync storage when a tombstoned page shrinks the merged set', async () => {
    // A page removed with no tombstone is indistinguishable from "not synced
    // yet" (see CLAUDE.md's "Deletion needs tombstones") - push now merges
    // against remote just like pull does, so only a genuinely tombstoned
    // deletion should shrink what gets pushed.
    const now = Date.now();
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [createPage(0, 'Only Page', 'value', { pageId: 'page-1', lastModified: now - 60000 })], 0);
    seedTombstones(localArea, [{ pageId: 'page-2', deletedAt: now }]);
    // Left over in sync storage from before the page was deleted locally.
    seedArea(syncArea, [
      createPage(0, 'Only Page', 'value', { pageId: 'page-1', lastModified: now - 60000 }),
      createPage(1, 'Deleted Page', 'value', { pageId: 'page-2', lastModified: now - 120000 }),
    ], 0);

    await syncLocalToRemoteStorage();

    expect(syncArea.store[`${PAGE_KEY_PREFIX}1`]).toBeUndefined();
  });

  it('writes current local tombstones to sync storage', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [createPage(0, 'Only Page')], 0);
    seedTombstones(localArea, [{ pageId: 'deleted-1', deletedAt: Date.now() - 1000 }]);

    await syncLocalToRemoteStorage();

    expect(readTombstones(syncArea)).toEqual([{ pageId: 'deleted-1', deletedAt: expect.any(Number) }]);
  });

  it('does not clobber a page another browser already pushed to sync storage that this browser has not pulled yet', async () => {
    // Regression test: pushing local's raw view (without merging against
    // sync storage's current state first) would overwrite a page pushed by
    // another browser in the gap since this browser's last pull - this is
    // the most likely explanation for "a new page sometimes doesn't sync to
    // the other browser at all".
    const now = Date.now();
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [
      createPage(0, 'Default', 'value', { pageId: 'default', lastModified: 0 }),
    ], 0);
    // Another browser already pushed a new page this one hasn't pulled yet.
    seedArea(syncArea, [
      createPage(0, 'Default', 'value', { pageId: 'default', lastModified: 0 }),
      createPage(1, 'Pushed elsewhere', 'value', { pageId: 'page-remote', lastModified: now - 1000 }),
    ], 0);

    await syncLocalToRemoteStorage();

    const syncPages = readLocalPages(syncArea);
    expect(syncPages.map((p) => p.pageId)).toContain('page-remote');
  });

  it('catches local up with anything the push-time merge discovered on sync storage', async () => {
    const now = Date.now();
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [
      createPage(0, 'Default', 'value', { pageId: 'default', lastModified: 0 }),
    ], 0);
    seedArea(syncArea, [
      createPage(0, 'Default', 'value', { pageId: 'default', lastModified: 0 }),
      createPage(1, 'Pushed elsewhere', 'value', { pageId: 'page-remote', lastModified: now - 1000 }),
    ], 0);

    await syncLocalToRemoteStorage();

    const localPages = readLocalPages(localArea);
    expect(localPages.map((p) => p.pageId)).toContain('page-remote');
  });

  it('does not include darkMode or selectedPage in what gets pushed to sync storage', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    localArea.store['darkMode'] = true;
    localArea.store[SELECTED_PAGE_KEY] = 3;
    seedArea(localArea, [createPage(0, 'Only Page')], 0);

    await syncLocalToRemoteStorage();

    expect(syncArea.store['darkMode']).toBeUndefined();
    expect(syncArea.store[SELECTED_PAGE_KEY]).toBeUndefined();
  });
});

describe('writePagesToLocalStorage race protection (via syncRemoteToLocalStorage)', () => {
  let localArea: MockArea;
  let syncArea: MockArea;

  beforeEach(() => {
    vi.clearAllMocks();
    localArea = createMockArea();
    syncArea = createMockArea();

    browserMock.storage.local.get.mockImplementation(localArea.get);
    browserMock.storage.local.set.mockImplementation(localArea.set);
    browserMock.storage.local.remove.mockImplementation(localArea.remove);
    browserMock.storage.sync.get.mockImplementation(syncArea.get);
    browserMock.storage.sync.set.mockImplementation(syncArea.set);
    browserMock.storage.sync.remove.mockImplementation(syncArea.remove);
  });

  it('does not resurrect a page (or erase its tombstone) when the foreground deletes it while a slower, already-in-flight merge - computed before the delete - is still writing', async () => {
    // Regression test: syncRemoteToLocalStorage's merge is computed from a
    // local/sync snapshot read at the *start* of the call. If the foreground
    // popup deletes a page (writing local storage directly, independent of
    // this call) while this call is still awaiting later storage
    // round-trips, its merge result has no idea the delete ever happened.
    // Before writePagesToLocalStorage re-read and unioned local's tombstones
    // immediately before committing, this write would silently overwrite the
    // just-created tombstone and resurrect the page it protected.
    const now = Date.now();
    const defaultPage = createPage(0, 'Default', undefined, { pageId: 'default', lastModified: 0 });
    const pageA = createPage(1, 'A', undefined, { pageId: 'page-a', lastModified: now - 100000 });
    const pageB = createPage(2, 'B', undefined, { pageId: 'page-b', lastModified: now - 100000 });

    // Local only knows about Default + A so far; sync already has B (pushed
    // by another browser) - this pull's job is to merge B in.
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [defaultPage, pageA]);
    seedArea(syncArea, [defaultPage, pageA, pageB]);

    // Stall writePagesToLocalStorage's own fresh tombstone read (its very
    // first local.get call after the outer merge has already been computed)
    // so a concurrent foreground delete can land in between.
    let resolveStall: () => void;
    const stall = new Promise<void>((r) => { resolveStall = r; });
    let resolveReachedStall: () => void;
    const reachedStall = new Promise<void>((r) => { resolveReachedStall = r; });
    let tombstoneGetCount = 0;
    const originalLocalGet = localArea.get.getMockImplementation()!;
    browserMock.storage.local.get.mockImplementation(async (key?: any) => {
      if (key === PAGE_TOMBSTONES_KEY) {
        tombstoneGetCount++;
        // The 1st read is readPageStorage's own read for the outer merge; the
        // 2nd is writePagesToLocalStorage's fresh re-check right before
        // committing - that's the one we want to stall.
        if (tombstoneGetCount === 2) {
          resolveReachedStall!();
          await stall;
        }
      }
      return originalLocalGet(key);
    });

    const pullPromise = syncRemoteToLocalStorage();
    await reachedStall;

    // The foreground deletes page A while the pull above is stalled mid-write.
    seedArea(localArea, [defaultPage].map((p, i) => ({ ...p, id: i })), 0);
    localArea.store[PAGE_TOMBSTONES_KEY] = [{ pageId: 'page-a', deletedAt: Date.now() }];

    resolveStall!();
    await pullPromise;

    const finalPages = readLocalPages(localArea);
    expect(finalPages.map((p) => p.pageId)).not.toContain('page-a');
    expect(finalPages.map((p) => p.pageId)).toContain('page-b');
    expect(readTombstones(localArea).map((t) => t.pageId)).toContain('page-a');
  });
});

describe('debounced push-on-local-change (initBackground)', () => {
  let localArea: MockArea;
  let syncArea: MockArea;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localArea = createMockArea();
    syncArea = createMockArea();

    browserMock.storage.local.get.mockImplementation(localArea.get);
    browserMock.storage.local.set.mockImplementation(localArea.set);
    browserMock.storage.local.remove.mockImplementation(localArea.remove);
    browserMock.storage.sync.get.mockImplementation(syncArea.get);
    browserMock.storage.sync.set.mockImplementation(syncArea.set);
    browserMock.storage.sync.remove.mockImplementation(syncArea.remove);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes shortly after a local page change instead of waiting for the next interval tick', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [createPage(0, 'Only Page', 'value', { pageId: 'page-1', lastModified: Date.now() })], 0);

    initBackground();
    const onLocalChanged = (browserMock.storage.local.onChanged.addListener as any).mock.calls[0][0] as
      (changes: Record<string, unknown>) => void;

    // Flush the startup pull-then-push microtask chain (no sync data yet, so
    // it's a fast no-op) before triggering the change under test.
    await vi.runOnlyPendingTimersAsync();
    vi.clearAllMocks();
    browserMock.storage.local.get.mockImplementation(localArea.get);
    browserMock.storage.local.set.mockImplementation(localArea.set);
    browserMock.storage.local.remove.mockImplementation(localArea.remove);
    browserMock.storage.sync.get.mockImplementation(syncArea.get);
    browserMock.storage.sync.set.mockImplementation(syncArea.set);
    browserMock.storage.sync.remove.mockImplementation(syncArea.remove);
    onLocalChanged({ [SETTINGS_V3_META_KEY]: { newValue: {}, oldValue: {} } });

    // Well under the 10s interval, but past the debounce - should already
    // have pushed via the fast path, not be waiting on the interval.
    await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DEBOUNCE_TIME + 100);

    expect(browserMock.storage.sync.set).toHaveBeenCalled();
    expect(readLocalPages(syncArea).map((p) => p.pageId)).toContain('page-1');
  });

  it('coalesces a burst of local changes into a single push', async () => {
    localArea.store[SYNC_ENABLED_KEY] = true;
    seedArea(localArea, [createPage(0, 'Only Page', 'value', { pageId: 'page-1', lastModified: Date.now() })], 0);

    initBackground();
    const onLocalChanged = (browserMock.storage.local.onChanged.addListener as any).mock.calls[0][0] as
      (changes: Record<string, unknown>) => void;

    await vi.runOnlyPendingTimersAsync();
    vi.clearAllMocks();
    browserMock.storage.local.get.mockImplementation(localArea.get);
    browserMock.storage.local.set.mockImplementation(localArea.set);
    browserMock.storage.local.remove.mockImplementation(localArea.remove);
    browserMock.storage.sync.get.mockImplementation(syncArea.get);
    browserMock.storage.sync.set.mockImplementation(syncArea.set);
    browserMock.storage.sync.remove.mockImplementation(syncArea.remove);

    for (let i = 0; i < 5; i++) {
      onLocalChanged({ [SETTINGS_V3_META_KEY]: { newValue: {}, oldValue: {} } });
      await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DEBOUNCE_TIME / 2);
    }
    await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DEBOUNCE_TIME + 100);

    expect(browserMock.storage.sync.set).toHaveBeenCalledTimes(1);
  });
});
