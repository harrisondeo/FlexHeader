import { vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  declarativeNetRequest: {
    isRegexSupported: vi.fn(async ({ regex }: { regex: string }) => {
      try {
        new RegExp(regex);
        return { isSupported: true };
      } catch {
        return { isSupported: false, reason: 'SYNTAX_ERROR' };
      }
    }),
  },
}));

vi.mock('webextension-polyfill', () => ({
  default: browserMock,
  ...browserMock,
}));

import { convertModHeaderProfile, isModHeaderExport } from './modHeaderImport';

const sampleModHeaderExport = [
  {
    alwaysOn: true,
    headers: [
      { appendMode: false, enabled: true, name: 'test', value: 'asdf', comment: 'Testing 2' },
      { appendMode: false, enabled: false, name: 'test', value: 'abcd' },
      { enabled: false, name: 'test', value: 'abc', comment: 'Testing' },
      { enabled: false, name: 'test', value: 'qwerty' },
    ],
    shortTitle: 'G',
    title: 'Testing Env',
    urlFilters: [
      { enabled: false, urlRegex: '.*://localhost:8080/.*' },
      { enabled: false, urlRegex: '.*://localhost:8000/.*' },
    ],
    version: 2,
    hideComment: false,
  },
];

describe('isModHeaderExport', () => {
  it('recognizes a ModHeader profile array', () => {
    expect(isModHeaderExport(sampleModHeaderExport)).toBe(true);
  });

  it('rejects a FlexHeader page export', () => {
    const flexHeaderExport = [
      {
        id: 0,
        name: 'Page',
        enabled: true,
        keepEnabled: false,
        showHeaderComments: true,
        headers: [],
        filters: [],
      },
    ];
    expect(isModHeaderExport(flexHeaderExport)).toBe(false);
  });

  it('rejects non-arrays and empty arrays', () => {
    expect(isModHeaderExport({})).toBe(false);
    expect(isModHeaderExport([])).toBe(false);
  });

  it('recognizes a profile with only URL filters configured, no headers yet', () => {
    const filtersOnlyProfile = [
      {
        title: 'Filters only',
        urlFilters: [{ enabled: true, urlRegex: '.*example\\.com.*' }],
      },
    ];
    expect(isModHeaderExport(filtersOnlyProfile)).toBe(true);
  });
});

describe('convertModHeaderProfile', () => {
  it('converts a ModHeader profile into an equivalent FlexHeader page', async () => {
    const warnings = new Set<string>();
    const page = await convertModHeaderProfile(sampleModHeaderExport[0], 0, warnings);

    expect(page.name).toBe('Testing Env');
    expect(page.keepEnabled).toBe(true); // alwaysOn -> keepEnabled
    expect(page.enabled).toBe(false); // imported disabled pending review
    expect(page.showHeaderComments).toBe(true); // !hideComment

    expect(page.headers).toHaveLength(4);
    expect(page.headers[0]).toMatchObject({
      headerName: 'test',
      headerValue: 'asdf',
      headerComment: 'Testing 2',
      headerEnabled: true,
      headerType: 'request',
    });
    expect(page.headers[1].headerEnabled).toBe(false);

    expect(page.filters).toHaveLength(2);
    expect(page.filters[0]).toMatchObject({
      type: 'include',
      mode: 'regex',
      enabled: false,
      value: '.*://localhost:8080/.*',
      valid: true,
    });

    expect(warnings.size).toBe(0);
  });

  it('maps response headers, exclude filters, and warns on lossy features', async () => {
    const warnings = new Set<string>();
    const profile = {
      title: 'Lossy',
      headers: [{ name: 'X-Req', value: '1', appendMode: true, enabled: true }],
      respHeaders: [{ name: 'X-Resp', value: '2', enabled: true }],
      urlFilters: [{ enabled: true, urlRegex: '.*a.*', methods: ['GET'] }],
      excludeUrlFilters: [{ enabled: true, urlRegex: '.*b.*' }],
    };

    const page = await convertModHeaderProfile(profile, 1, warnings);

    expect(page.headers).toHaveLength(2);
    expect(page.headers.find((h) => h.headerType === 'response')).toMatchObject({
      headerName: 'X-Resp',
      headerValue: '2',
    });
    expect(page.filters).toHaveLength(2);
    expect(page.filters.find((f) => f.type === 'exclude')).toMatchObject({
      value: '.*b.*',
      valid: true,
    });

    expect([...warnings].join(' ')).toMatch(/append mode/i);
    expect([...warnings].join(' ')).toMatch(/method filters/i);
  });

  it('marks filters with unsupported regex as invalid and warns', async () => {
    browserMock.declarativeNetRequest.isRegexSupported.mockResolvedValueOnce({
      isSupported: false,
      reason: 'SYNTAX_ERROR',
    });
    const warnings = new Set<string>();
    const profile = {
      title: 'Bad regex',
      headers: [{ name: 'X', value: '1', enabled: true }],
      urlFilters: [{ enabled: true, urlRegex: '(unterminated' }],
    };

    const page = await convertModHeaderProfile(profile, 0, warnings);

    expect(page.filters[0].valid).toBe(false);
    expect([...warnings].some((w) => /regex Chrome doesn't support/.test(w))).toBe(true);
  });

  it('falls back to a generated name when title and shortTitle are missing', async () => {
    const page = await convertModHeaderProfile({ headers: [] }, 2, new Set());
    expect(page.name).toBe('Imported profile 3');
  });
});
