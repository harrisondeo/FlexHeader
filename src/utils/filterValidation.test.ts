import { isValidUrlFilter } from './filterValidation';

describe('URL filter validation', () => {
  it('accepts common valid URL patterns', () => {
    expect(isValidUrlFilter('||example.com/')).toBe(true);
    expect(isValidUrlFilter('||example.com|')).toBe(true);
    expect(isValidUrlFilter('||example.com/path|')).toBe(true);
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

  it('rejects invalid domain-anchor plus right-anchor combinations', () => {
    expect(isValidUrlFilter('||example.com||')).toBe(false);
    expect(isValidUrlFilter('||example.com|path')).toBe(false);
  });

  it('rejects misplaced pipe characters', () => {
    expect(isValidUrlFilter('ex|ample.com')).toBe(false);
    expect(isValidUrlFilter('|foo|bar')).toBe(false);
    expect(isValidUrlFilter('foo|bar|')).toBe(false);
  });
});
