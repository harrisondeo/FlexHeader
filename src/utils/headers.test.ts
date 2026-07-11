import { normalizeFilter, normalizeHeader, normalizePage } from './headers';

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
});
