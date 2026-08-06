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
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
    setIcon: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('webextension-polyfill', () => ({
  default: browserMock,
  ...browserMock,
}));

import { renderHook, act, waitFor } from '@testing-library/react';
import useFlexHeaderSettings from '../settings';
import { SLIM_MODE_KEY } from '../../constants';

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

describe('useHeaderOperations (setAllHeadersEnabled)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('uses the persisted slim preference on the first render', () => {
    localStorage.setItem(SLIM_MODE_KEY, 'true');
    const observedValues: boolean[] = [];

    renderHook(() => {
      const settings = useFlexHeaderSettings();
      observedValues.push(settings.slimModeEnabled);
      return settings;
    });

    expect(observedValues[0]).toBe(true);
  });

  const renderWithHeaders = async () => {
    const { result } = renderHook(() => useFlexHeaderSettings());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));

    const pageId = result.current.pages[0].id;
    act(() => {
      result.current.addHeader(pageId, {
        headerName: 'X-Two',
        headerValue: '2',
        headerComment: '',
        headerEnabled: true,
        headerType: 'request',
      });
    });
    await waitFor(() => expect(result.current.pages[0].headers.length).toBe(2));

    return { result, pageId };
  };

  it('flips every header on the target page and leaves other pages alone', async () => {
    const { result, pageId } = await renderWithHeaders();

    act(() => {
      result.current.addPage({ ...result.current.pages[0], id: -1, name: 'Other' });
    });
    await waitFor(() => expect(result.current.pages.length).toBe(2));

    act(() => {
      result.current.setAllHeadersEnabled(pageId, false);
    });

    await waitFor(() => {
      const target = result.current.pages.find((p) => p.id === pageId)!;
      expect(target.headers.every((h) => !h.headerEnabled)).toBe(true);
    });

    const other = result.current.pages.find((p) => p.id !== pageId)!;
    expect(other.headers.every((h) => h.headerEnabled)).toBe(true);
  });

  it('is a single undo step, not one per header', async () => {
    const { result, pageId } = await renderWithHeaders();

    act(() => {
      result.current.setAllHeadersEnabled(pageId, false);
    });
    await waitFor(() =>
      expect(result.current.pages[0].headers.every((h) => !h.headerEnabled)).toBe(true)
    );

    act(() => {
      result.current.undo();
    });

    await waitFor(() =>
      expect(result.current.pages[0].headers.every((h) => h.headerEnabled)).toBe(true)
    );
  });
});
