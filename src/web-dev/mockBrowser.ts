/**
 * Browser API mock for the standalone web dev server.
 *
 * WXT / webextension-polyfill is aliased to this module in vite.web.config.ts
 * so the React UI can run in a normal browser tab with hot-module replacement.
 * Storage is backed by localStorage so state persists across reloads.
 */

declare const __APP_VERSION__: string;

const STORAGE_PREFIX = "flexheader-web-dev:";

type StorageKey = string | string[] | Record<string, any> | null;

const createStorageArea = (areaName: "local" | "sync") => {
  const prefix = `${STORAGE_PREFIX}${areaName}:`;

  const prefixedKey = (key: string): string => `${prefix}${key}`;

  const getAll = (): Record<string, any> => {
    const result: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey?.startsWith(prefix)) {
        const shortKey = fullKey.slice(prefix.length);
        try {
          result[shortKey] = JSON.parse(localStorage.getItem(fullKey) ?? "null");
        } catch {
          result[shortKey] = localStorage.getItem(fullKey);
        }
      }
    }
    return result;
  };

  const get = async (key?: StorageKey): Promise<Record<string, any>> => {
    const safeParse = (raw: string | null, fallback: any) => {
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };

    if (key === null || key === undefined) {
      return getAll();
    }

    if (typeof key === "string") {
      const value = localStorage.getItem(prefixedKey(key));
      return { [key]: safeParse(value, undefined) };
    }

    if (Array.isArray(key)) {
      const result: Record<string, any> = {};
      for (const k of key) {
        const value = localStorage.getItem(prefixedKey(k));
        result[k] = safeParse(value, undefined);
      }
      return result;
    }

    // Object form: keys with default values
    const result: Record<string, any> = {};
    for (const k of Object.keys(key)) {
      const value = localStorage.getItem(prefixedKey(k));
      result[k] = safeParse(value, key[k]);
    }
    return result;
  };

  const set = async (data: Record<string, any>): Promise<void> => {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        localStorage.removeItem(prefixedKey(key));
        continue;
      }
      localStorage.setItem(prefixedKey(key), JSON.stringify(value));
    }
  };

  const remove = async (keys: string | string[]): Promise<void> => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const key of keyList) {
      localStorage.removeItem(prefixedKey(key));
    }
  };

  const clear = async (): Promise<void> => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  };

  return {
    get,
    set,
    remove,
    clear,
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  };
};

const mockBrowser = {
  storage: {
    local: createStorageArea("local"),
    sync: createStorageArea("sync"),
  },
  declarativeNetRequest: {
    isRegexSupported: async ({ regex }: { regex: string }) => {
      try {
        new RegExp(regex);
        return { isSupported: true };
      } catch {
        return { isSupported: false, reason: "SYNTAX_ERROR" };
      }
    },
  },
  runtime: {
    getManifest: () => ({
      version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
    }),
    openOptionsPage: async () => {
      // In the web dev harness the options page is the same app without the
      // popup query parameter. Preserve the host/port so this works whether
      // Vite is running on its default port or an alternative.
      const url = new URL(window.location.href);
      url.search = "";
      // Open the settings layout in a new tab, just like a real extension's
      // options page. The subsequent closeActionPopup() then closes the popup
      // tab instead of the page we just navigated to.
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    },
    getURL: (path: string): string => path,
  },
  action: {
    setBadgeText: () => Promise.resolve(),
  },
  tabs: {
    create: ({ url }: { url?: string }) => {
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return Promise.resolve();
    },
  },
  extension: {
    getViews: () => [],
  },
};

export default mockBrowser as any;
