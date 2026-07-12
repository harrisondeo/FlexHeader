/**
 * Tests for settings merge/sync functionality
 * 
 * These tests focus on the merge logic used when syncing settings
 * between multiple browser instances:
 * - Page deduplication logic
 * - Merging pages from sync storage with local pages
 * - Preserving enabled state for existing pages
 */

jest.mock('webextension-polyfill', () => ({
  storage: {
    local: { get: jest.fn(), set: jest.fn(), clear: jest.fn(), remove: jest.fn() },
    sync: { get: jest.fn(), set: jest.fn(), clear: jest.fn(), remove: jest.fn() },
  },
  declarativeNetRequest: {
    isRegexSupported: jest.fn().mockResolvedValue({ isSupported: true }),
  },
}));

import { Page, HeaderSetting, HeaderFilter, isValidUrlFilter } from './settings';
import { normalizePage } from './headers';

// Extract the merge logic functions for testing
// These are pure functions that can be tested independently

/**
 * Creates a unique key for a page based on its name, headers, and filters
 * Used for deduplication during merge
 * Note: Only compares headerName, headerValue for headers and type, value for filters
 */
const getPageKey = (page: Page): string => {
  const sortedHeaders = [...page.headers].sort((a, b) => {
    if (a.headerName !== b.headerName) return a.headerName.localeCompare(b.headerName);
    if (a.headerValue !== b.headerValue) return a.headerValue.localeCompare(b.headerValue);
    return 0;
  });
  const sortedFilters = [...page.filters].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.mode !== b.mode) return a.mode.localeCompare(b.mode);
    if (a.value !== b.value) return String(a.value).localeCompare(String(b.value));
    return 0;
  });
  // Only include the properties used for comparison
  return `${page.name}_${JSON.stringify({
    headers: sortedHeaders.map(h => ({ headerName: h.headerName, headerValue: h.headerValue })),
    filters: sortedFilters.map(f => ({ type: f.type, mode: f.mode, value: f.value })),
  })}`;
};

/**
 * Merges pages from sync storage with local pages, avoiding duplicates
 */
const mergePages = (localPages: Page[], syncPages: Page[]): Page[] => {
  const localPagesMap = new Map<string, Page>();
  localPages.forEach(page => {
    localPagesMap.set(getPageKey(page), page);
  });

  const newPagesFromSync: Page[] = [];
  syncPages.forEach(syncPage => {
    if (!localPagesMap.has(getPageKey(syncPage))) {
      newPagesFromSync.push(syncPage);
    }
  });

  if (newPagesFromSync.length === 0) {
    return localPages;
  }

  const mergedPages = [
    ...localPages.map((page, index) => ({
      ...page,
      id: index,
    })),
    ...newPagesFromSync.map((page, index) => ({
      ...page,
      id: localPages.length + index,
      enabled: false, // New pages from sync are disabled by default
    }))
  ];

  return mergedPages;
};

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

describe('URL filter validation', () => {
  it('accepts common valid URL patterns', () => {
    expect(isValidUrlFilter('||example.com/')).toBe(true);
    expect(isValidUrlFilter('|https://example.com/')).toBe(true);
    expect(isValidUrlFilter('https://example.com|')).toBe(true);
    expect(isValidUrlFilter('|https://example.com|')).toBe(true);
    expect(isValidUrlFilter('example*^123|')).toBe(true);
    expect(isValidUrlFilter('*')).toBe(true);
  });

  it('rejects empty patterns', () => {
    expect(isValidUrlFilter('')).toBe(false);
    expect(isValidUrlFilter('|')).toBe(false);
  });

  it('rejects non-ASCII characters', () => {
    expect(isValidUrlFilter('||example.com/ф')).toBe(false);
  });

  it('rejects invalid domain anchors', () => {
    expect(isValidUrlFilter('||*')).toBe(false);
    expect(isValidUrlFilter('||')).toBe(false);
    expect(isValidUrlFilter('||ex|ample.com')).toBe(false);
  });

  it('rejects misplaced pipe characters', () => {
    expect(isValidUrlFilter('ex|ample.com')).toBe(false);
    expect(isValidUrlFilter('|foo|bar')).toBe(false);
    expect(isValidUrlFilter('foo|bar|')).toBe(false);
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

describe('Header Comment Import/Export', () => {
  it('should preserve header comments through exported JSON and imported pages', () => {
    const pages = [
      createPage(0, 'Routes', true, [
        {
          ...createHeader('X-Route', 'service-a'),
          headerComment: 'Use for checkout API',
        },
        {
          ...createHeader('X-Route', 'service-b'),
          headerComment: 'Use for catalog API',
        },
      ]),
    ];

    const exportedJson = JSON.stringify(pages);
    const importedPages = (JSON.parse(exportedJson) as Page[]).map(normalizePage);

    expect(importedPages[0].headers[0].headerComment).toBe('Use for checkout API');
    expect(importedPages[0].headers[1].headerComment).toBe('Use for catalog API');
  });

  it('should add an empty header comment when importing legacy headers', () => {
    const legacyPages = [
      {
        ...createPage(0, 'Legacy Routes', true, []),
        headers: [
          {
            id: 'legacy-1',
            headerName: 'X-Route',
            headerValue: 'legacy-service',
            headerEnabled: true,
          },
        ],
      },
    ];

    const exportedJson = JSON.stringify(legacyPages);
    const importedPages = (JSON.parse(exportedJson) as Page[]).map(normalizePage);

    expect(importedPages[0].headers[0]).toMatchObject({
      headerName: 'X-Route',
      headerValue: 'legacy-service',
      headerComment: '',
      headerType: 'request',
    });
  });

  it('should preserve the header comments visibility setting through JSON import/export', () => {
    const pages = [
      {
        ...createPage(0, 'Routes', true, [createHeader('X-Route', 'service-a')]),
        showHeaderComments: false,
      },
    ];

    const exportedJson = JSON.stringify(pages);
    const importedPages = (JSON.parse(exportedJson) as Page[]).map(normalizePage);

    expect(importedPages[0].showHeaderComments).toBe(false);
  });

  it('should show header comments by default for legacy imported pages', () => {
    const legacyPages = [
      {
        id: 0,
        name: 'Legacy Routes',
        enabled: true,
        keepEnabled: false,
        filters: [],
        headers: [createHeader('X-Route', 'legacy-service')],
      },
    ];

    const exportedJson = JSON.stringify(legacyPages);
    const importedPages = (JSON.parse(exportedJson) as Page[]).map(normalizePage);

    expect(importedPages[0].showHeaderComments).toBe(true);
  });
});
