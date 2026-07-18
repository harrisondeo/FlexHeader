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
import { mergePages } from '../domain/pageMerge';
import { HISTORY_ENABLED_KEY } from '../../constants';

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

describe('Undo/redo history', () => {
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses a rapid burst of header edits (e.g. keystrokes) into a single undo step', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const pageId = result.current.selectedPage;
    const header = result.current.pages[0].headers[0];
    const originalValue = header.headerValue;

    vi.useFakeTimers();

    act(() => {
      result.current.updateHeader(pageId, { ...header, headerValue: 'a' });
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.updateHeader(pageId, { ...header, headerValue: 'ab' });
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.updateHeader(pageId, { ...header, headerValue: 'abc' });
    });

    expect(result.current.pages[0].headers[0].headerValue).toBe('abc');
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.pages[0].headers[0].headerValue).toBe(originalValue);
    expect(result.current.canUndo).toBe(false);
  });

  it('starts a new undo step once the debounce window has elapsed between edits', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const pageId = result.current.selectedPage;
    const header = result.current.pages[0].headers[0];
    const originalValue = header.headerValue;

    vi.useFakeTimers();

    act(() => {
      result.current.updateHeader(pageId, { ...header, headerValue: 'a' });
    });
    act(() => {
      // Past HISTORY_DEBOUNCE_MS - the previous burst has closed.
      vi.advanceTimersByTime(600);
      result.current.updateHeader(pageId, { ...header, headerValue: 'ab' });
    });

    act(() => {
      result.current.undo();
    });
    expect(result.current.pages[0].headers[0].headerValue).toBe('a');

    act(() => {
      result.current.undo();
    });
    expect(result.current.pages[0].headers[0].headerValue).toBe(originalValue);
  });

  it('records a header deletion as its own undo step, separate from an edit made just before it', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const pageId = result.current.selectedPage;
    const header = result.current.pages[0].headers[0];

    act(() => {
      result.current.updateHeader(pageId, { ...header, headerValue: 'edited' });
    });
    act(() => {
      result.current.removeHeader(pageId, header.id);
    });

    expect(result.current.pages[0].headers.length).toBe(0);

    act(() => {
      result.current.undo();
    });
    expect(result.current.pages[0].headers.length).toBe(1);
    expect(result.current.pages[0].headers[0].headerValue).toBe('edited');

    act(() => {
      result.current.undo();
    });
    expect(result.current.pages[0].headers[0].headerValue).toBe(header.headerValue);
  });

  it('redo re-applies an undone change', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const pageId = result.current.selectedPage;
    const header = result.current.pages[0].headers[0];

    act(() => {
      result.current.updateHeader(pageId, { ...header, headerValue: 'edited' });
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.pages[0].headers[0].headerValue).toBe(header.headerValue);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.pages[0].headers[0].headerValue).toBe('edited');
    expect(result.current.canRedo).toBe(false);
  });

  it('a new edit clears the redo stack', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const pageId = result.current.selectedPage;
    const header = result.current.pages[0].headers[0];

    act(() => {
      result.current.updateHeader(pageId, { ...header, headerValue: 'edited' });
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.updateHeader(pageId, { ...header, headerValue: 'something else' });
    });
    expect(result.current.canRedo).toBe(false);
  });

  it('undoes a page rename', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const page = result.current.pages[0];
    const originalName = page.name;

    act(() => {
      result.current.updatePage({ ...page, name: 'Renamed Page' });
    });
    expect(result.current.pages[0].name).toBe('Renamed Page');

    act(() => {
      result.current.undo();
    });
    expect(result.current.pages[0].name).toBe(originalName);
  });

  it('records a filter deletion as an undoable step', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const pageId = result.current.selectedPage;

    act(() => {
      result.current.addFilter(pageId, { enabled: true, valid: true, type: 'include', mode: 'url', value: '||example.com/' });
    });
    await waitFor(() => expect(result.current.pages[0].filters.length).toBe(1));
    const filter = result.current.pages[0].filters[0];

    act(() => {
      result.current.removeFilter(pageId, filter.id);
    });
    expect(result.current.pages[0].filters.length).toBe(0);

    act(() => {
      result.current.undo();
    });
    expect(result.current.pages[0].filters.length).toBe(1);
  });

  it('has nothing to undo/redo on a fresh load', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('bumps lastModified on undo so a sync merge does not resurrect the undone edit', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const pageId = result.current.selectedPage;
    const header = result.current.pages[0].headers[0];

    act(() => {
      result.current.updateHeader(pageId, { ...header, headerValue: 'edited' });
    });
    // Simulates the edit above having already reached sync storage (e.g. a
    // background push that raced with the undo below) before the undo runs.
    const pushedToSync = result.current.pages;

    act(() => {
      result.current.undo();
    });
    expect(result.current.pages[0].headers[0].headerValue).toBe(header.headerValue);

    // A merge landing right after the undo must not treat the older-looking
    // undone snapshot as stale and reapply the edit it just reverted.
    const merged = mergePages(result.current.pages, pushedToSync);
    expect(merged).toBe(result.current.pages);
    expect(merged[0].headers[0].headerValue).toBe(header.headerValue);
  });
});

describe('Undo/redo history toggle', () => {
  let local: ReturnType<typeof createStorageArea>;

  beforeEach(() => {
    vi.clearAllMocks();
    local = createStorageArea();
    const sync = createStorageArea();

    browserMock.storage.local.get.mockImplementation(local.get);
    browserMock.storage.local.set.mockImplementation(local.set);
    browserMock.storage.local.remove.mockImplementation(local.remove);
    browserMock.storage.local.onChanged.addListener.mockImplementation(() => {});
    browserMock.storage.sync.get.mockImplementation(sync.get);
    browserMock.storage.sync.set.mockImplementation(sync.set);
    browserMock.storage.sync.remove.mockImplementation(sync.remove);
  });

  it('is enabled by default', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    expect(result.current.historyEnabled).toBe(true);
  });

  it('toggleHistoryEnabled flips state and persists the preference to local storage', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.toggleHistoryEnabled();
    });

    expect(result.current.historyEnabled).toBe(false);
    expect(local.store[HISTORY_ENABLED_KEY]).toBe(false);
  });

  it('stops recording and blocks undo/redo once disabled', async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.toggleHistoryEnabled();
    });

    const pageId = result.current.selectedPage;
    const header = result.current.pages[0].headers[0];

    act(() => {
      result.current.updateHeader(pageId, { ...header, headerValue: 'edited' });
    });

    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.undo();
    });
    expect(result.current.pages[0].headers[0].headerValue).toBe('edited');
  });
});
