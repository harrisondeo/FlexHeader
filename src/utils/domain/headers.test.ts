import { normalizeFilter, normalizeHeader, normalizePage } from './headers';
import type { HeaderSetting, Page } from './schemas';

const createHeader = (name: string, value: string, enabled = true): HeaderSetting => ({
  id: `test-${Date.now()}-${Math.random()}`,
  headerName: name,
  headerValue: value,
  headerComment: '',
  headerEnabled: enabled,
  headerType: 'request',
});

const createPage = (id: number, name: string, enabled: boolean, headers: HeaderSetting[] = []): Page => ({
  id,
  name,
  enabled,
  keepEnabled: false,
  showHeaderComments: true,
  filtersExpanded: true,
  headers,
  filters: [],
});

describe('normalizeFilter', () => {
  it('defaults a missing mode to regex', () => {
    const filter = {
      id: 'filter-1',
      enabled: true,
      valid: true,
      type: 'include',
      value: 'https://example\\.com/.*',
    };

    expect(normalizeFilter(filter).mode).toBe('regex');
  });

  it('preserves an explicit url mode', () => {
    const filter = {
      id: 'filter-1',
      enabled: true,
      valid: true,
      type: 'include',
      mode: 'url',
      value: '||example.com/',
    };

    expect(normalizeFilter(filter).mode).toBe('url');
  });
});

describe('normalizeHeader', () => {
  it('defaults a missing headerType to request', () => {
    const header = {
      id: 'header-1',
      headerName: 'X-Test',
      headerValue: 'value',
      headerEnabled: true,
    };

    expect(normalizeHeader(header).headerType).toBe('request');
  });

  it('preserves an explicit response headerType', () => {
    const header = {
      id: 'header-1',
      headerName: 'X-Test',
      headerValue: 'value',
      headerEnabled: true,
      headerType: 'response',
    };

    expect(normalizeHeader(header).headerType).toBe('response');
  });
});

describe('normalizePage', () => {
  it('migrates old stored pages by normalizing filters and headers', () => {
    const page = {
      id: 0,
      name: 'Default',
      enabled: true,
      keepEnabled: false,
      showHeaderComments: true,
      filters: [
        {
          id: 'filter-1',
          enabled: true,
          valid: true,
          type: 'include',
          value: 'https://example\\.com/.*',
        },
      ],
      headers: [
        {
          id: 'header-1',
          headerName: 'X-Test',
          headerValue: 'value',
          headerEnabled: true,
        },
      ],
    };

    const normalized = normalizePage(page);

    expect(normalized.filters[0].mode).toBe('regex');
    expect(normalized.headers[0].headerType).toBe('request');
  });

  it('defaults a missing filtersExpanded to true', () => {
    const page = {
      id: 0,
      name: 'Default',
      enabled: true,
      keepEnabled: false,
      showHeaderComments: true,
      filters: [],
      headers: [],
    };

    expect(normalizePage(page).filtersExpanded).toBe(true);
  });

  it('defaults a missing paused to false', () => {
    const page = {
      id: 0,
      name: 'Default',
      enabled: true,
      keepEnabled: false,
      showHeaderComments: true,
      filters: [],
      headers: [],
    };

    expect(normalizePage(page).paused).toBe(false);
  });

  it('preserves an existing paused value', () => {
    const page = {
      id: 0,
      name: 'Default',
      enabled: true,
      keepEnabled: false,
      paused: true,
      showHeaderComments: true,
      filters: [],
      headers: [],
    };

    expect(normalizePage(page).paused).toBe(true);
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
