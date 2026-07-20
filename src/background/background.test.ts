/**
 * Tests for background rule generation.
 *
 * These tests verify that declarativeNetRequest rules are built correctly
 * from page/header/filter state, especially the new exclude-filter behavior.
 */

import { buildHeaderRules, buildRulesFromPages, allResourceTypes } from './rules';
import type { HeaderFilter, HeaderSetting, Page } from '../utils/settings';
import { normalizePage } from '../utils/domain/headers';
import { compareWithFixture, shouldUpdateFixtures } from './__fixtures__/fixtureHelpers';

const createHeader = (overrides: Partial<HeaderSetting> = {}): HeaderSetting => ({
  id: 'header-1',
  headerName: 'X-Test',
  headerValue: 'test-value',
  headerComment: '',
  headerEnabled: true,
  headerType: 'request',
  ...overrides,
});

const createFilter = (overrides: Partial<HeaderFilter> = {}): HeaderFilter => ({
  id: 'filter-1',
  enabled: true,
  valid: true,
  type: 'include',
  mode: 'regex',
  value: 'https://example\\.com/.*',
  ...overrides,
});

describe('buildHeaderRules', () => {
  let idCounter: number;
  const getNextId = () => {
    idCounter += 1;
    return idCounter;
  };

  beforeEach(() => {
    idCounter = 0;
  });

  it('returns a single modifyHeaders rule with default filter when no filters are provided', () => {
    const header = createHeader();
    const rules = buildHeaderRules(header, [], getNextId);

    expect(rules).toHaveLength(1);
    expect(rules[0].action.type).toBe('modifyHeaders');
    expect(rules[0].priority).toBe(1);
    expect(rules[0].condition.regexFilter).toBe('|http*');
    expect(rules[0].condition.resourceTypes).toEqual(allResourceTypes);
  });

  it('creates a separate rule for each regex include filter', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://a\\.com/.*' }),
      createFilter({ id: '2', value: 'https://b\\.com/.*' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(2);
    expect(rules[0].condition.regexFilter).toBe('https://a\\.com/.*');
    expect(rules[1].condition.regexFilter).toBe('https://b\\.com/.*');
  });

  it('ignores disabled filters', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://a\\.com/.*', enabled: false }),
      createFilter({ id: '2', value: 'https://b\\.com/.*' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(1);
    expect(rules[0].condition.regexFilter).toBe('https://b\\.com/.*');
  });

  it('ignores invalid filters', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://a\\.com/.*', valid: false }),
      createFilter({ id: '2', value: 'https://b\\.com/.*' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(1);
    expect(rules[0].condition.regexFilter).toBe('https://b\\.com/.*');
  });

  it('emits a higher-priority remove rule for exclude filters', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://exclude\\.com/.*', type: 'exclude' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(2);
    expect(rules[0].action.type).toBe('modifyHeaders');
    expect(rules[0].priority).toBe(1);
    expect(rules[0].condition.regexFilter).toBe('|http*');

    expect(rules[1].action.type).toBe('modifyHeaders');
    expect(rules[1].priority).toBe(2);
    expect(rules[1].condition.regexFilter).toBe('https://exclude\\.com/.*');
    expect(rules[1].condition.resourceTypes).toEqual(allResourceTypes);

    const action = rules[1].action as { type: 'modifyHeaders'; requestHeaders: Array<{ header: string; operation: string }> };
    expect(action.requestHeaders).toEqual([{ header: 'X-Test', operation: 'remove' }]);
  });

  it('creates separate remove rules for each regex exclude filter', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://a\\.com/.*', type: 'exclude' }),
      createFilter({ id: '2', value: 'https://b\\.com/.*', type: 'exclude' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(3);
    expect(rules[1].action.type).toBe('modifyHeaders');
    expect(rules[1].condition.regexFilter).toBe('https://a\\.com/.*');
    expect(rules[2].condition.regexFilter).toBe('https://b\\.com/.*');
  });

  it('combines include and exclude filters into separate rules', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://include\\.com/.*', type: 'include' }),
      createFilter({ id: '2', value: 'https://exclude\\.com/.*', type: 'exclude' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(2);
    expect(rules[0].condition.regexFilter).toBe('https://include\\.com/.*');
    expect(rules[1].action.type).toBe('modifyHeaders');
    expect(rules[1].condition.regexFilter).toBe('https://exclude\\.com/.*');
  });

  it('uses responseHeaders removal for response header type exclude filters', () => {
    const header = createHeader({ headerType: 'response' });
    const filters = [
      createFilter({ id: '1', value: 'https://exclude\\.com/.*', type: 'exclude' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(2);
    const action = rules[1].action as { type: 'modifyHeaders'; responseHeaders: Array<{ header: string; operation: string }> };
    expect(action.responseHeaders).toEqual([{ header: 'X-Test', operation: 'remove' }]);
  });

  it('does not let one header exclude filter affect another header', () => {
    const headerA = createHeader({ id: 'header-a', headerName: 'X-A', headerValue: 'a' });
    const headerB = createHeader({ id: 'header-b', headerName: 'X-B', headerValue: 'b' });
    const excludeFilter = createFilter({ id: '1', value: 'https://exclude\\.com/.*', type: 'exclude' });

    const rulesA = buildHeaderRules(headerA, [excludeFilter], getNextId);
    const rulesB = buildHeaderRules(headerB, [], getNextId);

    const allRules = [...rulesA, ...rulesB];
    expect(allRules).toHaveLength(3);

    const rulesForB = allRules.filter((rule) => {
      const action = rule.action as { type: 'modifyHeaders'; requestHeaders?: Array<{ header: string; operation: string; value?: string }> };
      return action.requestHeaders?.some((h) => h.header === 'X-B');
    });
    expect(rulesForB).toHaveLength(1);
    expect(rulesForB[0].priority).toBe(1);
    expect(rulesForB[0].condition.regexFilter).toBe('|http*');

    const rulesRemovingA = allRules.filter((rule) => {
      const action = rule.action as { type: 'modifyHeaders'; requestHeaders?: Array<{ header: string; operation: string }> };
      return rule.priority === 2 && action.requestHeaders?.some((h) => h.header === 'X-A' && h.operation === 'remove');
    });
    expect(rulesRemovingA).toHaveLength(1);
    expect(rulesRemovingA[0].condition.regexFilter).toBe('https://exclude\\.com/.*');
  });

  it('uses responseHeaders for response header type', () => {
    const header = createHeader({ headerType: 'response' });
    const rules = buildHeaderRules(header, [], getNextId);

    expect(rules[0].action.type).toBe('modifyHeaders');
    const action = rules[0].action as { type: 'modifyHeaders'; responseHeaders: Array<{ header: string; operation: string; value: string }> };
    expect(action.responseHeaders).toEqual([
      { header: 'X-Test', operation: 'set', value: 'test-value' },
    ]);
  });

  it('uses requestHeaders by default when headerType is missing', () => {
    const header = createHeader({ headerType: undefined as unknown as 'request' });
    const rules = buildHeaderRules(header, [], getNextId);

    const action = rules[0].action as { type: 'modifyHeaders'; requestHeaders: Array<{ header: string; operation: string; value: string }> };
    expect(action.requestHeaders).toEqual([
      { header: 'X-Test', operation: 'set', value: 'test-value' },
    ]);
  });

  it('emits a urlFilter rule for a URL-mode include filter', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', mode: 'url', value: '||example.com/' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(1);
    expect(rules[0].condition.urlFilter).toBe('||example.com/');
    expect(rules[0].condition.regexFilter).toBeUndefined();
    expect(rules[0].priority).toBe(1);
  });

  it('does not emit default catch-all when a URL include filter exists', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', mode: 'url', value: '||example.com/' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(1);
    expect(rules[0].condition.regexFilter).toBeUndefined();
  });

  it('emits separate urlFilter rules for each URL include filter', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', mode: 'url', value: '||a.com/' }),
      createFilter({ id: '2', mode: 'url', value: '||b.com/' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(2);
    expect(rules[0].condition.urlFilter).toBe('||a.com/');
    expect(rules[1].condition.urlFilter).toBe('||b.com/');
  });

  it('emits a higher-priority urlFilter remove rule for URL exclude filters', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', mode: 'url', value: '||exclude.com/', type: 'exclude' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(2);
    expect(rules[0].condition.regexFilter).toBe('|http*');

    expect(rules[1].priority).toBe(2);
    expect(rules[1].condition.urlFilter).toBe('||exclude.com/');
    expect(rules[1].condition.regexFilter).toBeUndefined();

    const action = rules[1].action as { type: 'modifyHeaders'; requestHeaders: Array<{ header: string; operation: string }> };
    expect(action.requestHeaders).toEqual([{ header: 'X-Test', operation: 'remove' }]);
  });

  it('combines regex and URL include filters into separate rules', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', mode: 'regex', value: 'https://include\\.com/.*' }),
      createFilter({ id: '2', mode: 'url', value: '||example.com/' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(2);
    const regexRule = rules.find((rule) => rule.condition.regexFilter !== undefined);
    const urlRule = rules.find((rule) => rule.condition.urlFilter !== undefined);
    expect(regexRule?.condition.regexFilter).toBe('https://include\\.com/.*');
    expect(urlRule?.condition.urlFilter).toBe('||example.com/');
  });

  it('uses responseHeaders removal for response header type URL exclude filters', () => {
    const header = createHeader({ headerType: 'response' });
    const filters = [
      createFilter({ id: '1', mode: 'url', value: '||exclude.com/', type: 'exclude' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(2);
    const urlRemoveRule = rules.find((rule) => rule.condition.urlFilter !== undefined && rule.priority === 2);
    const action = urlRemoveRule!.action as { type: 'modifyHeaders'; responseHeaders: Array<{ header: string; operation: string }> };
    expect(action.responseHeaders).toEqual([{ header: 'X-Test', operation: 'remove' }]);
  });
});

describe('buildHeaderRules fixtures', () => {
  // Deterministic ID generator so fixture files stay stable.
  let fixtureIdCounter: number;
  const getNextFixtureId = () => {
    fixtureIdCounter += 1;
    return fixtureIdCounter;
  };

  beforeEach(() => {
    fixtureIdCounter = 100;
  });

  afterAll(() => {
    if (shouldUpdateFixtures()) {
      // eslint-disable-next-line no-console
      console.log('\nFixtures updated. Review the changes before committing.\n');
    }
  });

  it('matches the default catch-all fixture', () => {
    const header = createHeader();
    compareWithFixture(buildHeaderRules(header, [], getNextFixtureId), 'default-catch-all', [
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: '|http*', shouldBePresent: true },
    ]);
  });

  it('matches the regex includes fixture', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://a\\.com/.*' }),
      createFilter({ id: '2', value: 'https://b\\.com/.*' }),
    ];
    compareWithFixture(buildHeaderRules(header, filters, getNextFixtureId), 'regex-includes', [
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: 'https://a\\.com/.*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: 'https://b\\.com/.*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: '|http*', shouldBePresent: false },
    ]);
  });

  it('matches the URL includes fixture', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', mode: 'url', value: '||a.com/' }),
      createFilter({ id: '2', mode: 'url', value: '||b.com/' }),
    ];
    compareWithFixture(buildHeaderRules(header, filters, getNextFixtureId), 'url-includes', [
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'urlFilter', conditionValue: '||a.com/', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'urlFilter', conditionValue: '||b.com/', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'set', conditionType: 'regexFilter', shouldBePresent: false },
    ]);
  });

  it('matches the mixed includes fixture', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', mode: 'regex', value: 'https://include\\.com/.*' }),
      createFilter({ id: '2', mode: 'url', value: '||example.com/' }),
    ];
    compareWithFixture(buildHeaderRules(header, filters, getNextFixtureId), 'mixed-includes', [
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: 'https://include\\.com/.*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'urlFilter', conditionValue: '||example.com/', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: '|http*', shouldBePresent: false },
    ]);
  });

  it('matches the regex excludes fixture', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://a\\.com/.*', type: 'exclude' }),
      createFilter({ id: '2', value: 'https://b\\.com/.*', type: 'exclude' }),
    ];
    compareWithFixture(buildHeaderRules(header, filters, getNextFixtureId), 'regex-excludes', [
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: '|http*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'remove', priority: 2, conditionType: 'regexFilter', conditionValue: 'https://a\\.com/.*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'remove', priority: 2, conditionType: 'regexFilter', conditionValue: 'https://b\\.com/.*', shouldBePresent: true },
    ]);
  });

  it('matches the URL excludes fixture', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', mode: 'url', value: '||a.com/', type: 'exclude' }),
      createFilter({ id: '2', mode: 'url', value: '||b.com/', type: 'exclude' }),
    ];
    compareWithFixture(buildHeaderRules(header, filters, getNextFixtureId), 'url-excludes', [
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: '|http*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'remove', priority: 2, conditionType: 'urlFilter', conditionValue: '||a.com/', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'remove', priority: 2, conditionType: 'urlFilter', conditionValue: '||b.com/', shouldBePresent: true },
    ]);
  });

  it('matches the include and exclude fixture', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', mode: 'regex', value: 'https://include\\.com/.*' }),
      createFilter({ id: '2', mode: 'url', value: '||example.com/', type: 'include' }),
      createFilter({ id: '3', mode: 'regex', value: 'https://exclude\\.com/.*', type: 'exclude' }),
      createFilter({ id: '4', mode: 'url', value: '||exclude.com/', type: 'exclude' }),
    ];
    compareWithFixture(buildHeaderRules(header, filters, getNextFixtureId), 'include-and-exclude', [
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: 'https://include\\.com/.*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'urlFilter', conditionValue: '||example.com/', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'remove', priority: 2, conditionType: 'regexFilter', conditionValue: 'https://exclude\\.com/.*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'remove', priority: 2, conditionType: 'urlFilter', conditionValue: '||exclude.com/', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'set', conditionType: 'regexFilter', conditionValue: '|http*', shouldBePresent: false },
    ]);
  });

  it('matches the response header fixture', () => {
    const header = createHeader({ headerType: 'response' });
    const filters = [
      createFilter({ id: '1', value: 'https://exclude\\.com/.*', type: 'exclude' }),
    ];
    compareWithFixture(buildHeaderRules(header, filters, getNextFixtureId), 'response-header', [
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: '|http*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'remove', priority: 2, conditionType: 'regexFilter', conditionValue: 'https://exclude\\.com/.*', shouldBePresent: true },
    ]);
  });

  it('matches the multiple headers fixture', () => {
    const headerA = createHeader({ id: 'header-a', headerName: 'X-A', headerValue: 'a' });
    const headerB = createHeader({ id: 'header-b', headerName: 'X-B', headerValue: 'b' });
    const filters = [
      createFilter({ id: '1', value: 'https://shared\\.com/.*', type: 'include' }),
      createFilter({ id: '2', value: 'https://exclude-a\\.com/.*', type: 'exclude' }),
    ];

    const rules = [
      ...buildHeaderRules(headerA, filters, getNextFixtureId),
      ...buildHeaderRules(headerB, filters, getNextFixtureId),
    ];
    compareWithFixture(rules, 'multiple-headers', [
      { headerName: 'X-A', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: 'https://shared\\.com/.*', shouldBePresent: true },
      { headerName: 'X-A', operation: 'remove', priority: 2, conditionType: 'regexFilter', conditionValue: 'https://exclude-a\\.com/.*', shouldBePresent: true },
      { headerName: 'X-B', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: 'https://shared\\.com/.*', shouldBePresent: true },
      { headerName: 'X-B', operation: 'remove', priority: 2, conditionType: 'regexFilter', conditionValue: 'https://exclude-a\\.com/.*', shouldBePresent: true },
      { headerName: 'X-A', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: '|http*', shouldBePresent: false },
      { headerName: 'X-B', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: '|http*', shouldBePresent: false },
    ]);
  });

  it('matches the disabled and invalid filters fixture', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://enabled\\.com/.*', type: 'include' }),
      createFilter({ id: '2', value: 'https://disabled\\.com/.*', enabled: false }),
      createFilter({ id: '3', value: 'https://invalid\\.com/.*', valid: false }),
      createFilter({ id: '4', value: 'https://exclude-enabled\\.com/.*', type: 'exclude' }),
      createFilter({ id: '5', value: 'https://exclude-disabled\\.com/.*', type: 'exclude', enabled: false }),
    ];
    compareWithFixture(buildHeaderRules(header, filters, getNextFixtureId), 'disabled-invalid-filters', [
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: 'https://enabled\\.com/.*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'remove', priority: 2, conditionType: 'regexFilter', conditionValue: 'https://exclude-enabled\\.com/.*', shouldBePresent: true },
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: 'https://disabled\\.com/.*', shouldBePresent: false },
      { headerName: 'X-Test', operation: 'set', priority: 1, conditionType: 'regexFilter', conditionValue: 'https://invalid\\.com/.*', shouldBePresent: false },
      { headerName: 'X-Test', operation: 'remove', priority: 2, conditionType: 'regexFilter', conditionValue: 'https://exclude-disabled\\.com/.*', shouldBePresent: false },
    ]);
  });
});

describe('buildRulesFromPages migration regression', () => {
  let idCounter: number;
  const getNextId = () => {
    idCounter += 1;
    return idCounter;
  };

  beforeEach(() => {
    idCounter = 0;
  });

  it('still produces rules for filters stored before the mode field existed', () => {
    // This is the exact shape an older version of the extension would have
    // written to storage: filters have no `mode` and headers have no `headerType`.
    const oldStoredPage: Page = {
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
        } as unknown as HeaderFilter,
      ],
      headers: [
        {
          id: 'header-1',
          headerName: 'X-Migrated',
          headerValue: 'yes',
          headerComment: '',
          headerEnabled: true,
        } as unknown as HeaderSetting,
      ],
    };

    // background.ts calls normalizePage before building rules.
    const normalized = normalizePage(oldStoredPage);
    const rules = buildRulesFromPages([normalized], getNextId);

    expect(rules).toHaveLength(1);
    expect(rules[0].priority).toBe(1);
    expect(rules[0].condition.regexFilter).toBe('https://example\\.com/.*');

    const action = rules[0].action as { type: 'modifyHeaders'; requestHeaders: Array<{ header: string; operation: string; value: string }> };
    expect(action.requestHeaders).toEqual([
      { header: 'X-Migrated', operation: 'set', value: 'yes' },
    ]);
  });

  it('still applies default catch-all when an old page has no filters', () => {
    const oldStoredPage: Page = {
      id: 0,
      name: 'Default',
      enabled: true,
      keepEnabled: false,
      showHeaderComments: true,
      filters: [],
      headers: [
        {
          id: 'header-1',
          headerName: 'X-Always',
          headerValue: 'on',
          headerComment: '',
          headerEnabled: true,
        } as unknown as HeaderSetting,
      ],
    };

    const normalized = normalizePage(oldStoredPage);
    const rules = buildRulesFromPages([normalized], getNextId);

    expect(rules).toHaveLength(1);
    expect(rules[0].condition.regexFilter).toBe('|http*');
  });

  it('skips disabled pages even after normalization', () => {
    const oldStoredPage: Page = {
      id: 0,
      name: 'Default',
      enabled: false,
      keepEnabled: false,
      showHeaderComments: true,
      filters: [],
      headers: [
        {
          id: 'header-1',
          headerName: 'X-Disabled',
          headerValue: 'off',
          headerComment: '',
          headerEnabled: true,
        } as unknown as HeaderSetting,
      ],
    };

    const normalized = normalizePage(oldStoredPage);
    const rules = buildRulesFromPages([normalized], getNextId);

    expect(rules).toHaveLength(0);
  });
});
