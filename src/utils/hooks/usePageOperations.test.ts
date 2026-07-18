import { vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      remove: vi.fn(),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      remove: vi.fn(),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
  declarativeNetRequest: {
    isRegexSupported: vi.fn().mockResolvedValue({ isSupported: true }),
  },
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('webextension-polyfill', () => ({
  default: browserMock,
  ...browserMock,
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import useFlexHeaderSettings from '../settings';

// Regression coverage for a real bug: duplicating a page carried over its
// source pageId, so mergePages (which matches by pageId) treated the
// duplicate as "the same page, just edited" on another synced browser -
// whichever side's copy looked newer silently overwrote the original
// instead of the duplicate showing up as its own separate page.

const createStorageArea = () => {
  const store: Record<string, any> = {};
  return {
    store,
    get: vi.fn(async (key?: string | string[] | null) => {
      if (key === undefined || key === null) return { ...store };
      if (typeof key === 'string') return { [key]: store[key] };
      const result: Record<string, any> = {};
      key.forEach((k) => { result[k] = store[k]; });
      return result;
    }),
    set: vi.fn(async (data: Record<string, any>) => { Object.assign(store, data); }),
    remove: vi.fn(async (keys: string | string[]) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      arr.forEach((k) => delete store[k]);
    }),
  };
};

describe('usePageOperations (addPage identity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const local = createStorageArea();
    const sync = createStorageArea();

    browserMock.storage.local.get.mockImplementation(local.get);
    browserMock.storage.local.set.mockImplementation(local.set);
    browserMock.storage.local.remove.mockImplementation(local.remove);
    browserMock.storage.local.onChanged.addListener.mockImplementation(() => {});
    browserMock.storage.sync.get.mockImplementation(sync.get);
    browserMock.storage.sync.set.mockImplementation(sync.set);
    browserMock.storage.sync.remove.mockImplementation(sync.remove);
  });

  it('addPage always mints a new pageId, even if the source page object still carries one (duplicate-page case)', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const original = result.current.pages[0];
    expect(original.pageId).toBeDefined();

    act(() => {
      // Mirrors what a "Duplicate Page" handler does before calling addPage.
      result.current.addPage({
        ...original,
        id: -1,
        name: `${original.name} Copy`,
      });
    });

    await waitFor(() => expect(result.current.pages.length).toBe(2));
    const duplicate = result.current.pages.find((p) => p.name === `${original.name} Copy`);
    expect(duplicate?.pageId).toBeDefined();
    expect(duplicate?.pageId).not.toBe(original.pageId);
  });
});
