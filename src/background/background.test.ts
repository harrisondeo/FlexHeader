/**
 * Tests for background rule generation.
 *
 * These tests verify that declarativeNetRequest rules are built correctly
 * from page/header/filter state, especially the new exclude-filter behavior.
 */

import { buildHeaderRules, allResourceTypes } from './rules';
import { HeaderFilter, HeaderSetting } from '../utils/settings';

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

  it('joins include filters with a pipe into one regexFilter', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://a\\.com/.*' }),
      createFilter({ id: '2', value: 'https://b\\.com/.*' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(1);
    expect(rules[0].condition.regexFilter).toBe('https://a\\.com/.*|https://b\\.com/.*');
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

  it('joins multiple exclude filters with a pipe into one remove rule', () => {
    const header = createHeader();
    const filters = [
      createFilter({ id: '1', value: 'https://a\\.com/.*', type: 'exclude' }),
      createFilter({ id: '2', value: 'https://b\\.com/.*', type: 'exclude' }),
    ];

    const rules = buildHeaderRules(header, filters, getNextId);

    expect(rules).toHaveLength(2);
    expect(rules[1].action.type).toBe('modifyHeaders');
    expect(rules[1].condition.regexFilter).toBe('https://a\\.com/.*|https://b\\.com/.*');
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
});
