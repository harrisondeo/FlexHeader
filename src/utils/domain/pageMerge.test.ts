/**
 * Tests for pageMerge.ts - the merge logic used when syncing settings
 * between multiple browser instances:
 * - Page deduplication logic
 * - Merging pages from sync storage with local pages
 * - Tombstone-aware merge (deletion propagation)
 * - Preserving enabled state for existing pages
 */

import {
  getPageKey,
  mergePages,
  mergeSyncState,
  mergeTombstones,
  applyTombstones,
  pruneExpiredTombstones,
  createTombstone,
  synthesizeFallbackPage,
  reconcileHistoryAfterMerge,
  type PageTombstone,
} from './pageMerge';
import { TOMBSTONE_RETENTION_MS } from '../../constants';
import type { Page, HeaderSetting, HeaderFilter } from './schemas';

// Helper functions to create test data
const createHeader = (name: string, value: string, enabled = true): HeaderSetting => ({
  id: `test-${Date.now()}-${Math.random()}`,
  headerName: name,
  headerValue: value,
  headerComment: '',
  headerEnabled: enabled,
  headerType: 'request',
});

const createFilter = (type: 'include' | 'exclude', value: string, enabled = true, mode: 'regex' | 'url' = 'regex'): HeaderFilter => ({
  id: `filter-${Date.now()}-${Math.random()}`,
  type,
  mode,
  value,
  enabled,
  valid: true,
});

const createPage = (
  id: number,
  name: string,
  enabled: boolean,
  headers: HeaderSetting[] = [],
  filters: HeaderFilter[] = []
): Page => ({
  id,
  name,
  enabled,
  keepEnabled: false,
  showHeaderComments: true,
  filtersExpanded: true,
  headers,
  filters,
});

describe('Page Key Generation', () => {
  it('should generate same key for identical pages', () => {
    const page1 = createPage(0, 'Test Page', true, [
      createHeader('X-Test', 'value1'),
      createHeader('X-Another', 'value2'),
    ]);
    const page2 = createPage(1, 'Test Page', false, [
      createHeader('X-Test', 'value1'),
      createHeader('X-Another', 'value2'),
    ]);

    // Different id and enabled state should not affect the key
    expect(getPageKey(page1)).toBe(getPageKey(page2));
  });

  it('should generate different keys for pages with different names', () => {
    const page1 = createPage(0, 'Page 1', true, [createHeader('X-Test', 'value')]);
    const page2 = createPage(0, 'Page 2', true, [createHeader('X-Test', 'value')]);

    expect(getPageKey(page1)).not.toBe(getPageKey(page2));
  });

  it('should generate different keys for pages with different headers', () => {
    const page1 = createPage(0, 'Test Page', true, [createHeader('X-Test', 'value1')]);
    const page2 = createPage(0, 'Test Page', true, [createHeader('X-Test', 'value2')]);

    expect(getPageKey(page1)).not.toBe(getPageKey(page2));
  });

  it('should generate different keys for pages with different filters', () => {
    const page1 = createPage(0, 'Test Page', true, [], [createFilter('include', 'https://example.com')]);
    const page2 = createPage(0, 'Test Page', true, [], [createFilter('exclude', 'https://example.com')]);

    expect(getPageKey(page1)).not.toBe(getPageKey(page2));
  });

  it('should be order-independent for headers', () => {
    const page1 = createPage(0, 'Test Page', true, [
      createHeader('A-Header', 'value1'),
      createHeader('B-Header', 'value2'),
    ]);
    const page2 = createPage(0, 'Test Page', true, [
      createHeader('B-Header', 'value2'),
      createHeader('A-Header', 'value1'),
    ]);

    expect(getPageKey(page1)).toBe(getPageKey(page2));
  });

  it('should be order-independent for filters', () => {
    const page1 = createPage(0, 'Test Page', true, [], [
      createFilter('include', 'https://a.com'),
      createFilter('exclude', 'https://b.com'),
    ]);
    const page2 = createPage(0, 'Test Page', true, [], [
      createFilter('exclude', 'https://b.com'),
      createFilter('include', 'https://a.com'),
    ]);

    expect(getPageKey(page1)).toBe(getPageKey(page2));
  });

  it('should generate different keys for filters with the same value but different modes', () => {
    const page1 = createPage(0, 'Test Page', true, [], [createFilter('include', 'example.com', true, 'regex')]);
    const page2 = createPage(0, 'Test Page', true, [], [createFilter('include', 'example.com', true, 'url')]);

    expect(getPageKey(page1)).not.toBe(getPageKey(page2));
  });
});

describe('Page Merging', () => {
  describe('Basic Merge Scenarios', () => {
    it('should return local pages unchanged when sync has no new pages', () => {
      const localPages = [
        createPage(0, 'Page 1', true, [createHeader('X-Test', 'value')]),
      ];
      const syncPages = [
        createPage(0, 'Page 1', true, [createHeader('X-Test', 'value')]),
      ];

      const result = mergePages(localPages, syncPages);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Page 1');
    });

    it('should add new pages from sync storage', () => {
      const localPages = [
        createPage(0, 'Local Page', true, [createHeader('X-Local', 'local')]),
      ];
      const syncPages = [
        createPage(0, 'Sync Page', true, [createHeader('X-Sync', 'sync')]),
      ];

      const result = mergePages(localPages, syncPages);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Local Page');
      expect(result[1].name).toBe('Sync Page');
    });

    it('should disable new pages from sync by default', () => {
      const localPages = [
        createPage(0, 'Local Page', true, []),
      ];
      const syncPages = [
        createPage(0, 'Sync Page', true, []),
      ];

      const result = mergePages(localPages, syncPages);

      expect(result[0].enabled).toBe(true);  // Local page keeps its state
      expect(result[1].enabled).toBe(false); // Sync page is disabled
    });

    it('should re-index page IDs after merge', () => {
      const localPages = [
        createPage(5, 'Local Page', true, []),
      ];
      const syncPages = [
        createPage(10, 'Sync Page', true, []),
      ];

      const result = mergePages(localPages, syncPages);

      expect(result[0].id).toBe(0);
      expect(result[1].id).toBe(1);
    });
  });

  describe('Deduplication', () => {
    it('should not duplicate pages with same name and headers', () => {
      const header = createHeader('X-Test', 'value');
      const localPages = [
        createPage(0, 'Same Page', true, [header]),
      ];
      const syncPages = [
        createPage(0, 'Same Page', false, [header]),
      ];

      const result = mergePages(localPages, syncPages);

      expect(result).toHaveLength(1);
    });

    it('should add page with same name but different headers', () => {
      const localPages = [
        createPage(0, 'Same Page', true, [createHeader('X-Local', 'value')]),
      ];
      const syncPages = [
        createPage(0, 'Same Page', false, [createHeader('X-Sync', 'value')]),
      ];

      const result = mergePages(localPages, syncPages);

      expect(result).toHaveLength(2);
    });

    it('should add page with same headers but different name', () => {
      const header = createHeader('X-Test', 'value');
      const localPages = [
        createPage(0, 'Local Page', true, [header]),
      ];
      const syncPages = [
        createPage(0, 'Sync Page', false, [header]),
      ];

      const result = mergePages(localPages, syncPages);

      expect(result).toHaveLength(2);
    });
  });

  describe('Multi-Instance Scenarios', () => {
    it('should merge pages from multiple sync sources correctly', () => {
      const localPages = [
        createPage(0, 'Default', true, [createHeader('X-Default', 'default')]),
      ];
      const syncPages = [
        createPage(0, 'Work Profile', false, [createHeader('X-Work', 'work')]),
        createPage(1, 'Home Profile', false, [createHeader('X-Home', 'home')]),
      ];

      const result = mergePages(localPages, syncPages);

      expect(result).toHaveLength(3);
      expect(result.map(p => p.name)).toEqual(['Default', 'Work Profile', 'Home Profile']);
    });

    it('should handle complex merge with duplicates and new pages', () => {
      const sharedHeader = createHeader('X-Shared', 'shared');
      const localPages = [
        createPage(0, 'Shared Page', true, [sharedHeader]),
        createPage(1, 'Local Only', true, [createHeader('X-Local', 'local')]),
      ];
      const syncPages = [
        createPage(0, 'Shared Page', false, [sharedHeader]),  // Duplicate - should not be added
        createPage(1, 'Sync Only', false, [createHeader('X-Sync', 'sync')]),  // New - should be added
      ];

      const result = mergePages(localPages, syncPages);

      expect(result).toHaveLength(3);
      expect(result.map(p => p.name)).toEqual(['Shared Page', 'Local Only', 'Sync Only']);
    });

    it('should preserve local page enabled states', () => {
      const localPages = [
        createPage(0, 'Page A', true, []),
        createPage(1, 'Page B', false, []),
        createPage(2, 'Page C', true, []),
      ];
      const syncPages: Page[] = [];

      const result = mergePages(localPages, syncPages);

      expect(result[0].enabled).toBe(true);
      expect(result[1].enabled).toBe(false);
      expect(result[2].enabled).toBe(true);
    });

    it('should handle empty local pages with sync data', () => {
      const localPages: Page[] = [];
      const syncPages = [
        createPage(0, 'Sync Page 1', true, []),
        createPage(1, 'Sync Page 2', false, []),
      ];

      const result = mergePages(localPages, syncPages);

      expect(result).toHaveLength(2);
      expect(result[0].enabled).toBe(false); // Should be disabled as they come from sync
      expect(result[1].enabled).toBe(false);
    });

    it('should handle empty sync pages', () => {
      const localPages = [
        createPage(0, 'Local Page', true, []),
      ];
      const syncPages: Page[] = [];

      const result = mergePages(localPages, syncPages);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Local Page');
    });
  });
});

describe('Identity-based merge (pageId + lastModified)', () => {
  const withIdentity = (page: Page, pageId: string, lastModified: number): Page => ({
    ...page,
    pageId,
    lastModified,
  });

  it('updates an existing page in place when the incoming version is newer, instead of forking a duplicate', () => {
    // Regression test: the old content-based dedup key changed along with
    // the edited value, so this used to fork a duplicate instead of updating.
    const localPage = withIdentity(
      createPage(0, 'Work', true, [createHeader('X-Auth', 'old-token')]),
      'page-1',
      1000
    );
    const editedIncoming = withIdentity(
      createPage(0, 'Work', false, [createHeader('X-Auth', 'new-token')]),
      'page-1',
      2000
    );

    const result = mergePages([localPage], [editedIncoming]);

    expect(result).toHaveLength(1);
    expect(result[0].headers[0].headerValue).toBe('new-token');
    // Local-only state must survive the update
    expect(result[0].enabled).toBe(true);
    expect(result[0].id).toBe(0);
  });

  it('keeps the local version when it is newer than the incoming one', () => {
    const localPage = withIdentity(
      createPage(0, 'Work', true, [createHeader('X-Auth', 'newer-token')]),
      'page-1',
      5000
    );
    const staleIncoming = withIdentity(
      createPage(0, 'Work', false, [createHeader('X-Auth', 'older-token')]),
      'page-1',
      1000
    );

    const result = mergePages([localPage], [staleIncoming]);

    expect(result).toHaveLength(1);
    expect(result[0].headers[0].headerValue).toBe('newer-token');
  });

  it('is a no-op (same reference) when both sides are identical', () => {
    const localPage = withIdentity(createPage(0, 'Work', true, [createHeader('X-Auth', 'token')]), 'page-1', 1000);
    const incoming = withIdentity(createPage(0, 'Work', false, [createHeader('X-Auth', 'token')]), 'page-1', 1000);

    const localPages = [localPage];
    const result = mergePages(localPages, [incoming]);

    expect(result).toBe(localPages);
  });

  it('never collapses two distinct pages that happen to share identical content once both have their own pageId', () => {
    // Regression guard: once pages carry a real identity, content equality
    // alone must never be used to merge them - only a matching pageId can.
    const localPageA = withIdentity(createPage(0, 'Profile A', true, [createHeader('X-Shared', 'same-value')]), 'page-a', 1000);
    const incomingPageB = withIdentity(createPage(0, 'Profile B', false, [createHeader('X-Shared', 'same-value')]), 'page-b', 2000);

    const result = mergePages([localPageA], [incomingPageB]);

    expect(result).toHaveLength(2);
    expect(result.map(p => p.pageId)).toEqual(['page-a', 'page-b']);
  });

  it('adds a page with a new pageId as a new (disabled) page', () => {
    const localPage = withIdentity(createPage(0, 'Work', true, []), 'page-1', 1000);
    const newIncoming = withIdentity(createPage(0, 'Personal', false, [createHeader('X-New', 'value')]), 'page-2', 1000);

    const result = mergePages([localPage], [newIncoming]);

    expect(result).toHaveLength(2);
    expect(result[1].name).toBe('Personal');
    expect(result[1].enabled).toBe(false);
  });

  it('links a legacy local page (no pageId yet) to the incoming pageId via content match without discarding local edits made since', () => {
    // Simulates the upgrade window: this browser hasn't opened its popup
    // since the pageId field shipped, so its stored page still has none.
    const legacyLocal = createPage(0, 'Work', true, [createHeader('X-Auth', 'token')]);
    const incoming = withIdentity(createPage(0, 'Work', false, [createHeader('X-Auth', 'token')]), 'page-1', 500);

    const result = mergePages([legacyLocal], [incoming]);

    expect(result).toHaveLength(1);
    expect(result[0].pageId).toBe('page-1'); // now linked for future merges
    expect(result[0].enabled).toBe(true); // local state preserved
  });
});

describe('Tombstone-aware merge (mergeSyncState)', () => {
  const withIdentity = (page: Page, pageId: string, lastModified: number): Page => ({
    ...page,
    pageId,
    lastModified,
  });
  const tombstone = (pageId: string, deletedAt: number): PageTombstone => ({ pageId, deletedAt });
  const defaultPageTemplate = createPage(0, 'Default', true);
  // mergeSyncState prunes tombstones older than the retention window against
  // the real clock, so fixtures used through it must be recent, not small
  // relative integers like 1000/2000 (those look ancient vs. Date.now() and
  // get pruned before ever being applied).
  const recently = (msAgo: number) => Date.now() - msAgo;

  it('createTombstone returns null for a page with no pageId', () => {
    expect(createTombstone(createPage(0, 'Work', true))).toBeNull();
  });

  it('createTombstone stamps the page\'s pageId with the current time', () => {
    const result = createTombstone(withIdentity(createPage(0, 'Work', true), 'page-1', 1000));
    expect(result?.pageId).toBe('page-1');
    expect(result?.deletedAt).toBeGreaterThan(0);
  });

  it('synthesizeFallbackPage mints a fresh identity distinct from the template', () => {
    const template = withIdentity(createPage(0, 'Default', true), 'default', 0);
    const result = synthesizeFallbackPage(template);
    expect(result.pageId).not.toBe('default');
    expect(result.name).toBe('Default');
    expect(result.lastModified).toBeGreaterThan(0);
  });

  it('applyTombstones excludes a page whose tombstone is newer than its lastModified', () => {
    const page = withIdentity(createPage(0, 'Work', true), 'page-1', 1000);
    expect(applyTombstones([page], [tombstone('page-1', 2000)])).toHaveLength(0);
  });

  it('applyTombstones keeps a page whose lastModified is newer than its tombstone (an edit resurrects a delete)', () => {
    const page = withIdentity(createPage(0, 'Work', true), 'page-1', 3000);
    expect(applyTombstones([page], [tombstone('page-1', 2000)])).toHaveLength(1);
  });

  it('applyTombstones is a no-op (same reference) when no page matches any tombstone', () => {
    const pages = [withIdentity(createPage(0, 'Work', true), 'page-1', 1000)];
    expect(applyTombstones(pages, [tombstone('unrelated', 5000)])).toBe(pages);
  });

  it('mergeTombstones unions two lists, keeping the newest deletedAt per pageId', () => {
    const result = mergeTombstones([tombstone('page-1', 1000)], [tombstone('page-1', 2000), tombstone('page-2', 500)]);
    expect(result).toHaveLength(2);
    expect(result.find(t => t.pageId === 'page-1')?.deletedAt).toBe(2000);
  });

  it('mergeTombstones is a no-op (same reference) when incoming has nothing newer', () => {
    const local = [tombstone('page-1', 2000)];
    expect(mergeTombstones(local, [tombstone('page-1', 1000)])).toBe(local);
  });

  it('pruneExpiredTombstones drops entries past the retention window', () => {
    const now = Date.now();
    const tombstones = [tombstone('old', now - TOMBSTONE_RETENTION_MS - 1), tombstone('recent', now)];
    expect(pruneExpiredTombstones(tombstones, now).map(t => t.pageId)).toEqual(['recent']);
  });

  it('pruneExpiredTombstones is a no-op (same reference) when nothing is expired', () => {
    const tombstones = [tombstone('recent', Date.now())];
    expect(pruneExpiredTombstones(tombstones, Date.now())).toBe(tombstones);
  });

  it('reproduces the reported bug: does not resurrect a page deleted locally when a stale, larger remote set is pulled', () => {
    // Local already deleted "Old Page" and recorded a tombstone for it, but
    // remote sync storage still has the old, larger page set (push hasn't
    // run yet) - this is exactly the ordering that caused the reported bug.
    const survivor = withIdentity(createPage(0, 'Work', true, [createHeader('X-Auth', 'token')]), 'page-1', recently(60000));
    const deletedButStillRemote = withIdentity(createPage(1, 'Old Page', false), 'page-2', recently(20000));

    const result = mergeSyncState(
      { pages: [survivor], tombstones: [tombstone('page-2', recently(5000))] },
      { pages: [survivor, deletedButStillRemote], tombstones: [] },
      defaultPageTemplate
    );

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageId).toBe('page-1');
  });

  it('propagates a remote delete to a local-only page even with no matching incoming page at all (third device)', () => {
    const localOnly = withIdentity(createPage(0, 'Shared', true, [createHeader('X-Shared', 'v')]), 'shared-1', recently(20000));

    const result = mergeSyncState(
      { pages: [localOnly], tombstones: [] },
      { pages: [], tombstones: [tombstone('shared-1', recently(5000))] },
      defaultPageTemplate
    );

    expect(result.pages.map(p => p.pageId)).not.toContain('shared-1');
  });

  it('lets a newer edit win over an older tombstone for the same page (resurrection)', () => {
    const editedAfterDelete = withIdentity(createPage(0, 'Work', true, [createHeader('X-Auth', 'new')]), 'page-1', recently(2000));

    const result = mergeSyncState(
      { pages: [editedAfterDelete], tombstones: [] },
      { pages: [], tombstones: [tombstone('page-1', recently(20000))] },
      defaultPageTemplate
    );

    expect(result.pages.map(p => p.pageId)).toContain('page-1');
  });

  it('is a no-op (same references) when neither side has anything new', () => {
    const page = withIdentity(createPage(0, 'Work', true), 'page-1', 1000);
    const localPages = [page];
    const localTombstones: PageTombstone[] = [];

    const result = mergeSyncState(
      { pages: localPages, tombstones: localTombstones },
      { pages: [page], tombstones: [] },
      defaultPageTemplate
    );

    expect(result.pages).toBe(localPages);
    expect(result.tombstones).toBe(localTombstones);
  });

  it('never returns an empty page list, and the synthesized fallback is not immediately re-excluded by the tombstone that emptied the list', () => {
    const onlyPage = withIdentity(createPage(0, 'Default', true), 'default', 0);

    const result = mergeSyncState(
      { pages: [onlyPage], tombstones: [] },
      { pages: [], tombstones: [tombstone('default', recently(5000))] },
      onlyPage
    );

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageId).not.toBe('default');
  });
});

describe('reconcileHistoryAfterMerge', () => {
  const withIdentity = (page: Page, pageId: string, lastModified: number): Page => ({
    ...page,
    pageId,
    lastModified,
  });
  const tombstone = (pageId: string, deletedAt: number): PageTombstone => ({ pageId, deletedAt });
  const snapshot = (...pages: Page[]) => ({ pages, selectedPage: pages[0]?.id ?? 0 });

  it('keeps a stack entry whose pages the merge never touched', () => {
    const untouched = withIdentity(createPage(0, 'Work', true), 'page-1', 1000);
    const stack = [snapshot(untouched)];

    const result = reconcileHistoryAfterMerge(stack, [untouched], []);
    expect(result).toBe(stack);
  });

  it('drops an entry whose page was tombstoned by the merge', () => {
    const deleted = withIdentity(createPage(0, 'Work', true), 'page-1', 1000);
    const stack = [snapshot(deleted)];

    const result = reconcileHistoryAfterMerge(stack, [], [tombstone('page-1', 2000)]);
    expect(result).toHaveLength(0);
  });

  it('drops an entry whose page was edited remotely with a newer lastModified than the snapshot holds', () => {
    const stale = withIdentity(createPage(0, 'Work', true, [createHeader('X-Auth', 'old')]), 'page-1', 1000);
    const mergedRemote = withIdentity(createPage(0, 'Work', true, [createHeader('X-Auth', 'new')]), 'page-1', 2000);
    const stack = [snapshot(stale)];

    const result = reconcileHistoryAfterMerge(stack, [mergedRemote], []);
    expect(result).toHaveLength(0);
  });

  it('keeps an entry whose page is newer remotely but content-identical (no real conflict)', () => {
    const header = createHeader('X-Auth', 'same');
    const local = withIdentity(createPage(0, 'Work', true, [header]), 'page-1', 1000);
    const mergedRemote = withIdentity(createPage(0, 'Work', true, [header]), 'page-1', 2000);
    const stack = [snapshot(local)];

    const result = reconcileHistoryAfterMerge(stack, [mergedRemote], []);
    expect(result).toHaveLength(1);
  });

  it('keeps entries for unaffected pages while dropping only the conflicting one', () => {
    const unaffected = withIdentity(createPage(0, 'Home', true), 'page-1', 1000);
    const deleted = withIdentity(createPage(1, 'Old Page', true), 'page-2', 1000);

    const goodEntry = snapshot(unaffected);
    const badEntry = { pages: [unaffected, deleted], selectedPage: 0 };
    const stack = [goodEntry, badEntry];

    const result = reconcileHistoryAfterMerge(stack, [unaffected], [tombstone('page-2', 2000)]);
    expect(result).toEqual([goodEntry]);
  });

  it('treats a legacy page with no pageId as stale rather than risk restoring it', () => {
    const legacy = createPage(0, 'Work', true); // no pageId
    const stack = [snapshot(legacy)];

    const result = reconcileHistoryAfterMerge(stack, [legacy], []);
    expect(result).toHaveLength(0);
  });

  it('is a no-op (same reference) when nothing in the stack is invalidated', () => {
    const page = withIdentity(createPage(0, 'Work', true), 'page-1', 1000);
    const stack = [snapshot(page)];

    expect(reconcileHistoryAfterMerge(stack, [page], [])).toBe(stack);
  });
});

describe('New User Scenarios', () => {
  it('should work with default empty page for new user', () => {
    const defaultPage = createPage(0, 'Default', true, [
      {
        id: 'default-1',
        headerName: 'X-Frame-Options',
        headerValue: 'ALLOW-FROM https://www.youtube.com/',
        headerComment: '',
        headerEnabled: true,
        headerType: 'request',
      },
    ]);
    const syncPages: Page[] = [];

    const result = mergePages([defaultPage], syncPages);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Default');
  });

  it('should merge default page with existing sync data for reinstall', () => {
    const defaultPage = createPage(0, 'Default', true, [
      {
        id: 'default-1',
        headerName: 'X-Frame-Options',
        headerValue: 'ALLOW-FROM https://www.youtube.com/',
        headerComment: '',
        headerEnabled: true,
        headerType: 'request',
      },
    ]);
    const syncPages = [
      createPage(0, 'My Custom Page', true, [createHeader('X-Custom', 'value')]),
    ];

    const result = mergePages([defaultPage], syncPages);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Default');
    expect(result[1].name).toBe('My Custom Page');
  });
});

describe('Existing User Scenarios', () => {
  describe('Single Extension Instance', () => {
    it('should not change pages when no sync data exists', () => {
      const localPages = [
        createPage(0, 'My Page 1', true, [createHeader('X-Test', 'test1')]),
        createPage(1, 'My Page 2', false, [createHeader('X-Test', 'test2')]),
      ];

      const result = mergePages(localPages, []);

      expect(result).toEqual(localPages);
    });
  });

  describe('Multiple Extension Instances', () => {
    it('should merge pages from another browser instance', () => {
      // Simulating: User has extension on Browser A and Browser B
      // Browser A has different pages than Browser B
      const browserAPages = [
        createPage(0, 'Work Profile', true, [createHeader('X-Auth', 'work-token')]),
      ];
      const browserBPages = [
        createPage(0, 'Home Profile', true, [createHeader('X-Auth', 'home-token')]),
      ];

      const result = mergePages(browserAPages, browserBPages);

      expect(result).toHaveLength(2);
      expect(result.find(p => p.name === 'Work Profile')).toBeDefined();
      expect(result.find(p => p.name === 'Home Profile')).toBeDefined();
    });

    it('should handle partial overlap between instances', () => {
      const sharedHeader = createHeader('X-Shared', 'shared-value');
      const browserAPages = [
        createPage(0, 'Shared Page', true, [sharedHeader]),
        createPage(1, 'Browser A Only', true, [createHeader('X-A', 'a')]),
      ];
      const browserBPages = [
        createPage(0, 'Shared Page', true, [sharedHeader]),
        createPage(1, 'Browser B Only', true, [createHeader('X-B', 'b')]),
      ];

      const result = mergePages(browserAPages, browserBPages);

      expect(result).toHaveLength(3);
      expect(result.map(p => p.name)).toContain('Shared Page');
      expect(result.map(p => p.name)).toContain('Browser A Only');
      expect(result.map(p => p.name)).toContain('Browser B Only');
    });
  });
});
