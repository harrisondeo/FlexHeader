import { useEffect, useState, useCallback, useRef } from "react";
import { useAlert } from "../context/alertContext";
import browser from "webextension-polyfill";
import { z } from "zod";
import { SELECTED_PAGE_KEY, SETTINGS_V3_META_KEY, PAGE_KEY_PREFIX, PAGE_TOMBSTONES_KEY, SYNC_ENABLED_KEY, ERRORS_STATE_KEY, LAST_MERGE_TIME_KEY } from "../constants";
import { saveToStorage, loadFromStorage, clearStorage, getAllFromStorage, getDataSizeInBytes } from "./storage";
import { log } from "./log";
import { normalizePage } from "./headers";
import { mergeSyncState, createTombstone, synthesizeFallbackPage, applyTombstones, pruneExpiredTombstones, type PageTombstone } from "./pageMerge";
import { AppError, addStoredError, clearStoredErrors, getStoredErrors, injectTestError, ErrorCategory } from "./errors";

export enum SettingsErrorType {
  None = "None",
  SaveError = "SaveError",
}

export const filterTypeSchema = z.enum(["include", "exclude"]);
export const filterModeSchema = z.enum(["regex", "url"]);

export const headerSettingSchema = z.object({
  id: z.string(),
  headerName: z.string(),
  headerValue: z.string(),
  headerComment: z.string().default(""),
  headerEnabled: z.boolean(),
  headerType: z.enum(["request", "response"]).default("request"),
});

export const headerFilterSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  valid: z.boolean(),
  type: filterTypeSchema,
  mode: filterModeSchema.default("regex"),
  value: z.string(),
});

export const pageSchema = z.object({
  id: z.number(),
  // Stable identity so mergePages can match "the same page" across browsers
  // even after an edit changes its content. Optional (not zod-defaulted)
  // because a default here would fabricate a fresh id on every parse -
  // legacy pages are backfilled once instead, in retrieveSettings.
  pageId: z.string().optional(),
  name: z.string().min(1),
  enabled: z.boolean(),
  keepEnabled: z.boolean(),
  showHeaderComments: z.boolean().default(true),
  filtersExpanded: z.boolean().default(true),
  filters: z.array(headerFilterSchema).default([]),
  headers: z.array(headerSettingSchema).default([]),
  // Resolves which side wins when the same page is edited on two synced
  // browsers. Optional rather than defaulted so legacy pages don't need one -
  // readers treat a missing value as 0, the oldest possible timestamp.
  lastModified: z.number().optional(),
});

export const pagesDataSchema = z.object({
  pages: z.array(pageSchema),
  selectedPage: z.number(),
});

export const settingsV3MetaSchema = z.object({
  version: z.literal(3),
  selectedPage: z.number(),
  pageCount: z.number(),
});

export type FilterType = z.infer<typeof filterTypeSchema>;
export type FilterMode = z.infer<typeof filterModeSchema>;
export type HeaderSetting = z.infer<typeof headerSettingSchema>;
export type HeaderFilter = z.infer<typeof headerFilterSchema>;
export type Page = z.infer<typeof pageSchema>;
export type PagesData = z.infer<typeof pagesDataSchema>;
export type SettingsV3Meta = z.infer<typeof settingsV3MetaSchema>;

/**
 * The debouncing logic has been moved into the component to allow access to the timeout ref
 * for handling window unload events
 */

export const defaultPage: Page = {
  id: 0,
  // Fixed (not random) so that two fresh installs on the same sync account
  // recognize each other's untouched default page as the same page instead
  // of forking into a duplicate the first time they sync.
  pageId: "default",
  name: "Default",
  enabled: true,
  keepEnabled: false,
  showHeaderComments: true,
  filtersExpanded: true,
  filters: [],
  lastModified: 0,
  headers: [
    {
      id: "default-1",
      headerName: "X-Frame-Options",
      headerValue: "ALLOW-FROM https://www.youtube.com/",
      headerComment: "",
      headerEnabled: true,
      headerType: "request",
    },
  ],
};

/**
 * Validates a URL pattern (urlFilter) for declarativeNetRequest.
 * urlFilter syntax: '*' wildcard, '|' left/right anchor, '||' domain anchor,
 * '^' separator. Must be non-empty, ASCII only, and use anchors correctly.
 */
export const isValidUrlFilter = (value: string): boolean => {
  if (!value || value.length === 0) return false;

  // ASCII only
  if (/[^\x20-\x7E]/.test(value)) return false;

  // Domain anchor
  if (value.startsWith("||")) {
    if (value === "||*" || value === "||") return false;
    // Optional right anchor: the only other '|' allowed is a single trailing one
    const afterDomain = value.slice(2);
    const trailingPipe = afterDomain.endsWith("|");
    const core = trailingPipe ? afterDomain.slice(0, -1) : afterDomain;
    if (core.length === 0) return false;
    if (core.includes("|")) return false;
    return true;
  }

  // Left and/or right anchors: '|' can only appear at start or end, and must not be the only character
  const pipes = value.split("|").length - 1;
  if (pipes > 2) return false;
  if (pipes === 1) {
    if (value.length === 1) return false;
    if (value[0] !== "|" && value[value.length - 1] !== "|") return false;
  }
  if (pipes === 2 && (value[0] !== "|" || value[value.length - 1] !== "|")) return false;
  return true;
};

const filterIsValid = async (
  filter: Omit<HeaderFilter, "valid">,
  callback: (valid: boolean) => void
) => {
  if (filter.mode === "url") {
    callback(isValidUrlFilter(filter.value));
    return;
  }

  try {
    browser.declarativeNetRequest
      .isRegexSupported({
        regex: filter.value,
      })
      .then((result) => {
        callback(result.isSupported);
      });
  } catch (error) {
    callback(false);
  }
};

export const clearStoredSettings = async () => {
  await clearStorage('both');
};

function useFlexHeaderSettings() {
  const [lastError, setLastError] = useState<{ type: SettingsErrorType; time: number }>({ type: SettingsErrorType.None, time: 0 });
  const [pagesData, setPagesData] = useState<PagesData>({
    pages: [defaultPage],
    selectedPage: defaultPage.id,
  });
  const [tombstones, setTombstones] = useState<PageTombstone[]>([]);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [saveVersion, setSaveVersion] = useState(0);
  const [errors, setErrors] = useState<AppError[]>([]);
  const isSavingRef = useRef<boolean>(false);
  const hasPendingSaveRef = useRef<boolean>(false);
  const alertContext = useAlert();

  /**
   * Handles saving data to local storage and manages cleanup of extra pages
   * Syncing to remote storage is now handled by the background service worker
   * @param settings The complete settings data
   * @param tombstonesToSave The current delete tombstones, saved alongside pages
   */
  const saveToStorages = useCallback(async (settings: PagesData, tombstonesToSave: PageTombstone[]) => {
    try {
      // Create metadata
      const metadata: SettingsV3Meta = {
        version: 3,
        selectedPage: settings.selectedPage,
        pageCount: settings.pages.length,
      };

      try {
        log(`SETTINGS: Saving to local storage`, "warning");

        const dataToWrite: Record<string, unknown> = {
          [SETTINGS_V3_META_KEY]: metadata,
          [PAGE_TOMBSTONES_KEY]: pruneExpiredTombstones(tombstonesToSave),
          localModifiedTime: Date.now(),
        };

        settings.pages.forEach((page, index) => {
          const pageKey = `${PAGE_KEY_PREFIX}${index}`;
          const sizeInBytes = getDataSizeInBytes(page);
          const STORAGE_LIMIT = 5242880; // 5MB for local storage

          if (sizeInBytes > STORAGE_LIMIT) {
            alertContext.setAlert({
              alertType: "error",
              alertText: `Page too large (${(sizeInBytes / 1024).toFixed(1)}KB > ${STORAGE_LIMIT / 1024}KB). Please reduce the number of headers.`,
              location: "bottom",
            });
            throw new Error(`Page ${index} exceeds storage limit: ${sizeInBytes} bytes > ${STORAGE_LIMIT} bytes`);
          }

          dataToWrite[pageKey] = page;
        });

        await browser.storage.local.set(dataToWrite);

        // Clear save errors once a successful save has completed
        await clearStoredErrors("save");

        // Clean up any extra pages from storage
        try {
          const allData = await getAllFromStorage('local');
          const pageKeys = Object.keys(allData)
            .filter(key => key.startsWith(PAGE_KEY_PREFIX))
            .filter(key => {
              const pageIndex = parseInt(key.replace(PAGE_KEY_PREFIX, ''));
              return pageIndex >= settings.pages.length;
            });

          if (pageKeys.length > 0) {
            log(`SETTINGS: Cleaning up ${pageKeys.length} extra keys from local storage`, "info");
            await browser.storage.local.remove(pageKeys);
          }
        } catch (cleanupError) {
          log(`SETTINGS: Error cleaning up extra pages from local storage: ${cleanupError}`, "error");
          // Don't fail the whole operation for cleanup errors
        }

      } catch (error) {
        console.error(`Failed to save to local storage:`, error);
        throw error; // Re-throw for local storage errors
      } finally {
        log(`SETTINGS: Finished saving to local storage`, "success");
      }

      // On success, clear error state
      setLastError({ type: SettingsErrorType.None, time: 0 });
    } catch (error) {
      console.error(`Failed to save settings:`, error);
      setLastError({ type: SettingsErrorType.SaveError, time: Date.now() });
      const message = error instanceof Error ? error.message : "Failed to save settings";
      await addStoredError(
        "save",
        message,
        error instanceof Error ? error.stack : undefined
      );
      alertContext.setAlert({
        alertType: "error",
        alertText: "Failed to save settings. Please try again.",
        location: "bottom",
      });
    }
  }, [alertContext]);

  useEffect(() => {
    const selectedPage = pagesData.pages.find((page) => page.enabled);
    if (selectedPage) {
      const activeHeaders = selectedPage.headers.filter(
        (header) => header.headerEnabled
      );
      browser.action.setBadgeText({
        text: activeHeaders.length.toString(),
      });
    } else {
      browser.action.setBadgeText({
        text: "",
      });
    }
  }, [pagesData]);

  // Create a ref to track the previous pages data to prevent unnecessary saves
  const prevPagesDataRef = useRef<string | null>(null);

  // Main save effect that watches for data changes
  useEffect(() => {
    if (!hasInitialized) return;

    if (isSavingRef.current) {
      hasPendingSaveRef.current = true;
      return;
    }

    // Stringify current data for comparison
    const currentDataString = JSON.stringify(pagesData);

    // Only save if data has changed
    if (prevPagesDataRef.current === currentDataString) {
      return;
    }

    // Block recent saves after errors to prevent infinite error loops
    if (lastError.type === SettingsErrorType.SaveError && Date.now() - lastError.time < 60 * 1000) {
      console.warn("Skipping save: recent save error within last minute.");
      alertContext.setAlert({
        alertType: "error",
        alertText: "Changes not saved due to recent error. Please try again later.",
        location: "bottom",
      });
      return;
    }

    // Update reference for next comparison
    prevPagesDataRef.current = currentDataString;

    // Start save operation
    isSavingRef.current = true;
    log("SETTINGS: Saving changes to storage", "warning");

    // Make a deep copy to avoid mutation issues
    const settingsToSave = JSON.parse(JSON.stringify(pagesData));

    // Save to local storage immediately
    saveToStorages(settingsToSave, tombstones)
      .finally(() => {
        setTimeout(() => {
          isSavingRef.current = false;
          log("SETTINGS: Changes saved successfully", "success");
          if (hasPendingSaveRef.current) {
            hasPendingSaveRef.current = false;
            setSaveVersion((version) => version + 1);
          }
        }, 0);
      });
  }, [pagesData, tombstones, hasInitialized, lastError, saveToStorages, alertContext, saveVersion]);

  /**
   * Loads the settings from storage and sets the state
   */
  const retrieveSettings = useCallback(async () => {
    // Load dark mode setting
    try {
      const darkModeValue = await loadFromStorage("darkMode", false, ['local', 'sync']);
      setDarkModeEnabled(darkModeValue);

      // If darkMode wasn't found in either storage, save the default value
      if (darkModeValue === false) {
        await saveToStorage("darkMode", false, 'local');
      }
    } catch (error) {
      console.error("Failed to load dark mode setting:", error);
    }

    // Load sync preference
    try {
      const syncEnabledValue = await loadFromStorage(SYNC_ENABLED_KEY, false, ['local']);
      setSyncEnabled(syncEnabledValue);
    } catch (error) {
      console.error("Failed to load sync preference:", error);
    }

    try {
      // First try to get metadata from local storage (preferred source), then sync
      const meta = await loadFromStorage<SettingsV3Meta | null>(SETTINGS_V3_META_KEY, null, ['local', 'sync']);
      let storageType: 'local' | 'sync' = 'local';

      // Determine which storage actually had the metadata
      try {
        const localMeta = await browser.storage.local.get(SETTINGS_V3_META_KEY);
        if (!localMeta[SETTINGS_V3_META_KEY]) {
          storageType = 'sync';
        }
      } catch {
        storageType = 'sync';
      }

      if (meta) {
        log("SETTINGS: Loading settings from distributed storage format", "info");

        // Load all pages
        const pagePromises = [];
        for (let i = 0; i < meta.pageCount; i++) {
          const pageKey = `${PAGE_KEY_PREFIX}${i}`;
          pagePromises.push(loadFromStorage<Page | null>(pageKey, null, [storageType]));
        }

        const [pagesWithNulls, loadedTombstones] = await Promise.all([
          Promise.all(pagePromises),
          loadFromStorage<PageTombstone[]>(PAGE_TOMBSTONES_KEY, [], [storageType]),
        ]);
        let pages: Page[] = pagesWithNulls
          .filter((page): page is Page => page !== null) // Remove any null/undefined pages with type guard
          .map(normalizePage)
          // Backfilled here (not in normalizePage) so it happens once and gets
          // persisted by the save effect below - normalizePage also runs on
          // background.ts's non-persisting reads, which would otherwise
          // re-fabricate a throwaway id every time.
          .map((page) => ({ ...page, pageId: page.pageId || crypto.randomUUID() }));

        // This device has no local data yet and is bootstrapping straight from
        // sync - apply tombstones directly (not the full mergeSyncState/
        // mergePages path, which would mark every incoming page disabled;
        // there's no existing local selection to protect here).
        if (storageType === 'sync') {
          pages = applyTombstones(pages, loadedTombstones);
        }

        setTombstones(loadedTombstones);

        if (pages.length === 0) {
          // No pages found, use default
          setPagesData({
            pages: [defaultPage],
            selectedPage: defaultPage.id,
          });
        } else {
          setPagesData({
            pages,
            selectedPage: meta.selectedPage,
          });
          // If loaded from sync, save a copy to local storage
          if (storageType === 'sync') {
            log("SETTINGS: Saving sync data to local storage", "info");
            // Save to local storage
            await saveToStorages({
              pages,
              selectedPage: meta.selectedPage,
            }, loadedTombstones);
          }
        }

        setHasInitialized(true);
        return;
      }

      // No existing settings found, use default
      setPagesData({
        pages: [defaultPage],
        selectedPage: defaultPage.id,
      });
      setTombstones([]);
      setHasInitialized(true);

    } catch (error) {
      console.error("Failed to retrieve settings:", error);
      alertContext.setAlert({
        alertType: "error",
        alertText: "Failed to load settings. Using default configuration.",
        location: "bottom",
      });

      setPagesData({
        pages: [defaultPage],
        selectedPage: defaultPage.id,
      });
      setTombstones([]);
      setHasInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveToStorages]);

  /**
   * Clears the storage and sets the state to the default page
   */
  const clear = async () => {
    // Clear both storage types
    await clearStorage('both');

    setPagesData({
      pages: [defaultPage],
      selectedPage: defaultPage.id,
    });
    setTombstones([]);
  };

  /**
   * Page functions
   */

  /**
   * Creates a new page, enabled it and saves it to storage
   * @param page The page object to add
   */
  const addPage = (page: Page) => {
    const newPages = [
      ...pagesData.pages.map((p) => ({ ...p, enabled: false })),
      {
        ...page,
        id: pagesData.pages.length,
        enabled: true,
        pageId: page.pageId || crypto.randomUUID(),
        lastModified: Date.now(),
      },
    ];

    const testData = {
      pages: newPages,
      selectedPage: newPages.length - 1,
    };

    setPagesData(testData);
  };

  /**
   * Will delete a page and save the new pages to storage
   * @param id The ID of the page to remove
   * @param autoSelectPage Whether to automatically select the next page after removing the current one
   */
  const removePage = (id: number, autoSelectPage: boolean) => {
    const removedPage = pagesData.pages.find((page) => page.id === id);
    let newPages = pagesData.pages.filter((page) => page.id !== id);

    // if there are no pages left after removing the page, add a fresh default
    // page - NOT the defaultPage constant itself, since it shares its fixed
    // pageId with the page we may have just tombstoned below, which would
    // make the very next sync merge immediately re-exclude it.
    if (newPages.length === 0) {
      newPages.push(synthesizeFallbackPage(defaultPage));
    }

    newPages = newPages.map((page, index) => ({ ...page, id: index }));

    const newPageId = autoSelectPage
      ? newPages[newPages.length - 1].id
      : pagesData.selectedPage;

    newPages = _changeSelectedPage(newPageId, newPages);

    setPagesData({
      pages: newPages,
      selectedPage: newPageId,
    });

    const tombstone = removedPage && createTombstone(removedPage);
    if (tombstone) {
      setTombstones((prev) => [...prev, tombstone]);
    }

    alertContext.setAlert({
      alertType: "info",
      alertText: "Page removed.",
      location: "bottom",
    });
  };

  /**
   * Updated a pages data and saves it to storage
   * @param page The page object to update
   */
  const updatePage = (page: Page) => {
    const newPages = pagesData.pages.map((p) => (p.id === page.id ? { ...page, lastModified: Date.now() } : p));

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));
  };

  /**
   * INTERNAL ONLY - Update pages object to change the selected page
   * @param id
   * @param pages
   * @param save
   */
  const _changeSelectedPage = (id: number, pages: Page[]): Page[] =>
    pages.map((page) => ({
      ...page,
      enabled: page.id === id,
    }));

  /**
   * EXTERNAL - Used for external components to change the selected page
   * @param id The ID of the page to select
   */
  const changeSelectedPage = (id: number) => {
    const pagesToEdit = _changeSelectedPage(id, [...pagesData.pages]);

    setPagesData({
      pages: pagesToEdit,
      selectedPage: id,
    });
  };

  const changePageIndex = (oldIndex: number, newIndex: number) => {
    const newPages = [...pagesData.pages];
    const [removed] = newPages.splice(oldIndex, 1);

    newPages.splice(Math.max(newIndex, 0), 0, removed);

    const updatedPages = newPages.map((page, index) => ({
      ...page,
      id: index,
    }));

    setPagesData({
      pages: updatedPages,
      selectedPage: newIndex,
    });
  };

  /**
   * Header functions
   */

  /**
   * INTERNAL ONLY - Re-indexes the headers after one is removed or added
   * @param headers
   * @returns reindexed headers
   */
  const _reIndexHeaders = (headers: HeaderSetting[]): HeaderSetting[] =>
    headers.map((header, index) => ({
      ...header,
      id: `${header.id.split("-")[0]}-${index + 1}`,
    }));

  /**
   * Adds a new header to a given page
   * @param pageId The page that the header will be added to
   * @param header The header object to add
   */
  const addHeader = (pageId: number, header: Omit<HeaderSetting, "id">) => {
    const newPages = pagesData.pages.map((page) =>
      page.id === pageId
        ? {
          ...page,
          lastModified: Date.now(),
          headers: [
            ...page.headers,
            {
              ...header,
              headerType: header.headerType || "request",
              headerComment: header.headerComment || "",
              id: `${pageId}-${page.headers.length + 1}`,
            },
          ],
        }
        : page
    );

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));

    return newPages.find((page) => page.id === pageId)?.headers.slice(-1)[0];
  };

  /**
   * Removes a header from a given page
   * @param pageId The page that the header will be removed from
   * @param id The id of the header to remove
   */
  const removeHeader = (pageId: number, id: string) => {
    const newPages = pagesData.pages.map((page) =>
      page.id === pageId
        ? {
          ...page,
          lastModified: Date.now(),
          headers: _reIndexHeaders(
            page.headers.filter((header) => header.id !== id)
          ),
        }
        : page
    );

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));
  };

  /**
   * Allows you to save the headers data after a change.
   * The function WILL re-index the headers to avoid conflicts
   * @param newHeaders | The new headers array to save
   * @param pageId | The page that the headers belong to
   */
  const saveHeaders = (newHeaders: HeaderSetting[], pageId: number) => {
    const reIndexedHeaders = _reIndexHeaders(newHeaders);

    const newPages = pagesData.pages.map((page) =>
      page.id === pageId ? { ...page, headers: reIndexedHeaders, lastModified: Date.now() } : page
    );

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));
  };

  /**
   * Updates the values of a header
   * @param pageId The page that the header belongs to
   * @param header The new header object, the id should match the header to update
   */
  const updateHeader = (pageId: number, header: HeaderSetting) => {
    const newPages = pagesData.pages.map((page) =>
      page.id === pageId
        ? {
          ...page,
          lastModified: Date.now(),
          headers: page.headers.map((h) => (h.id === header.id ? header : h)),
        }
        : page
    );

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));
  };

  /**
   * Filter functions
   */

  /**
   * Adds a new filter to a given page
   * @param pageId | The page that the filter will be added to
   * @param filter | The filter object to add
   */
  const addFilter = (pageId: number, filter: Omit<HeaderFilter, "id">) => {
    const newPages = pagesData.pages.map((page) =>
      page.id === pageId
        ? {
          ...page,
          lastModified: Date.now(),
          filters: [
            ...page.filters,
            { ...filter, id: `${pageId}-${page.filters.length + 1}` },
          ],
        }
        : page
    );

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));
  };

  /**
   * Removes a filter from a page
   * @param pageId | The page that the filter belongs to
   * @param filterId | The id of the filter to remove
   */
  const removeFilter = (pageId: number, filterId: string) => {
    const newPages = pagesData.pages.map((page) =>
      page.id === pageId
        ? {
          ...page,
          lastModified: Date.now(),
          filters: page.filters.filter((filter) => filter.id !== filterId),
        }
        : page
    );

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));
  };

  /**
   * Updates the values of a filter
   * @param pageId | The page that the filter belongs to
   * @param filter | The new filter object, the id should match the filter to update
   */
  const updateFilter = (
    pageId: number,
    filter: Omit<HeaderFilter, "valid">
  ) => {
    filterIsValid(filter, (result) => {
      const newPages = pagesData.pages.map((page) =>
        page.id === pageId
          ? {
            ...page,
            lastModified: Date.now(),
            filters: page.filters.map((f) =>
              f.id === filter.id ? { ...filter, valid: result } : f
            ),
          }
          : page
      );

      setPagesData((prev) => ({
        ...prev,
        pages: newPages,
      }));
    });
  };

  /**
   * Dark Mode
   */
  const toggleDarkMode = async () => {
    try {
      const darkMode = await loadFromStorage("darkMode", false, ['local']);
      const newDarkMode = !darkMode;

      // Save to local storage only, background service worker will sync it
      await saveToStorage("darkMode", newDarkMode, 'local');
      setDarkModeEnabled(newDarkMode);
    } catch (error) {
      console.error("Error toggling dark mode:", error);
    }
  };

  /**
   * Loads pages from sync storage
   * @returns The pages from sync storage or null if none found
   */
  const loadPagesFromSync = async (): Promise<Page[] | null> => {
    try {
      // Check for v3 format in sync storage
      const syncMeta = await browser.storage.sync.get(SETTINGS_V3_META_KEY);
      const meta = syncMeta[SETTINGS_V3_META_KEY] as SettingsV3Meta | undefined;

      if (meta) {
        const pagePromises = [];
        for (let i = 0; i < meta.pageCount; i++) {
          pagePromises.push(browser.storage.sync.get(`${PAGE_KEY_PREFIX}${i}`));
        }
        const pageResults = await Promise.all(pagePromises);
        const pages = pageResults
          .map((result, index) => result[`${PAGE_KEY_PREFIX}${index}`] as Page)
          .filter(Boolean)
          .map(normalizePage);
        return pages.length > 0 ? pages : null;
      }

      return null;
    } catch (error) {
      console.error("Failed to load pages from sync storage:", error);
      return null;
    }
  };

  /**
   * Toggle sync feature
   * When enabling sync, merges sync data with local data to avoid data loss
   */
  const toggleSync = async () => {
    try {
      const newSyncEnabled = !syncEnabled;

      // Save sync preference first to avoid race conditions with auto-save
      await saveToStorage(SYNC_ENABLED_KEY, newSyncEnabled, 'local');
      setSyncEnabled(newSyncEnabled);

      if (newSyncEnabled) {
        // Enabling sync - merge with whatever already exists in sync storage.
        // Runs unconditionally (no one-shot "already migrated" gate) since
        // mergeSyncState is idempotent - a no-op merge is cheap and this way
        // any tombstones/edits made while sync was off still reconcile
        // immediately on re-enable instead of waiting for the next interval.
        log("SETTINGS: Enabling sync, checking for existing sync data to merge", "info");

        const [syncPages, syncTombstones] = await Promise.all([
          loadPagesFromSync(),
          loadFromStorage<PageTombstone[]>(PAGE_TOMBSTONES_KEY, [], ['sync']),
        ]);

        const merged = mergeSyncState(
          { pages: pagesData.pages, tombstones },
          { pages: syncPages ?? [], tombstones: syncTombstones },
          defaultPage
        );

        const pagesChanged = merged.pages !== pagesData.pages;
        const tombstonesChanged = merged.tombstones !== tombstones;
        let selectedPage = pagesData.selectedPage;

        if (pagesChanged) {
          // Try to preserve the selected page, or select the first enabled page
          const currentSelectedPage = pagesData.pages[pagesData.selectedPage];
          let newSelectedPage = currentSelectedPage
            ? merged.pages.findIndex((p) => p.name === currentSelectedPage.name)
            : -1;
          if (newSelectedPage === -1) {
            newSelectedPage = merged.pages.findIndex((p) => p.enabled);
          }
          if (newSelectedPage === -1) {
            newSelectedPage = 0; // fallback
          }
          selectedPage = newSelectedPage;

          setPagesData({ pages: merged.pages, selectedPage });
        }

        if (tombstonesChanged) {
          setTombstones(merged.tombstones);
        }

        if (pagesChanged || tombstonesChanged) {
          const newPagesCount = merged.pages.length - pagesData.pages.length;
          log(`SETTINGS: Merged sync storage data (${Math.max(newPagesCount, 0)} new page(s))`, "info");
          await saveToStorages({ pages: merged.pages, selectedPage }, merged.tombstones);

          alertContext.setAlert({
            alertType: "info",
            alertText: newPagesCount > 0
              ? `Sync enabled! ${newPagesCount} page(s) merged from other browsers.`
              : "Sync enabled! Existing pages were updated from other browsers.",
            location: "bottom",
          });
        } else {
          alertContext.setAlert({
            alertType: "success",
            alertText: "Sync enabled! Your settings will now sync across browsers.",
            location: "bottom",
          });
        }
      } else {
        // Disabling sync
        alertContext.setAlert({
          alertType: "info",
          alertText: "Sync disabled. Settings will only be stored locally.",
          location: "bottom",
        });
      }
    } catch (error) {
      console.error("Error toggling sync:", error);
      alertContext.setAlert({
        alertType: "error",
        alertText: "Failed to toggle sync. Please try again.",
        location: "bottom",
      });
    }
  };

  const importedPayloadSchema = z
    .array(pageSchema)
    .min(1, "Imported file does not contain any pages.");

  /**
   * Import json file
   */
  const importSettings = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.onload = (e) => {
        try {
          const result = e.target?.result;

          if (typeof result !== "string") {
            reject(new Error("Unable to read file contents."));
            return;
          }

          const parsed = importedPayloadSchema.parse(JSON.parse(result));

          // remap the ids to avoid conflicts
          setPagesData((prev) => {
            const importedPages = parsed.map(normalizePage).map((page) => ({
              ...page,
              // A fresh id if the file has none, so an imported page never
              // merge-matches an unrelated existing page by coincidence.
              pageId: page.pageId || crypto.randomUUID(),
              lastModified: page.lastModified || Date.now(),
            }));
            const combinedPages = [...prev.pages, ...importedPages];
            const newPages = combinedPages.map((page, index) => ({
              ...page,
              id: index,
            }));

            return {
              ...prev,
              pages: newPages,
            };
          });

          alertContext.setAlert({
            alertType: "success",
            alertText: "Settings imported.",
            location: "bottom",
          });

          resolve();
        } catch (error) {
          const err =
            error instanceof z.ZodError
              ? new Error(
                  "Invalid settings file. Please export settings from FlexHeaders and try again."
                )
              : error instanceof Error
                ? error
                : new Error("Failed to import settings.");

          alertContext.setAlert({
            alertType: "error",
            alertText: err.message,
            location: "bottom",
          });

          reject(err);
        }
      };
      reader.readAsText(file);
    });
  };

  useEffect(() => {
    retrieveSettings();
  }, [retrieveSettings]);

  useEffect(() => {
    // Only save to local storage, background service worker will handle syncing
    saveToStorage(SELECTED_PAGE_KEY, pagesData.selectedPage, 'local')
      .catch(err => console.error("Failed to save selected page to local storage:", err));
  }, [pagesData.selectedPage]);

  // Keep errors in sync with local storage so they can be surfaced in the UI
  useEffect(() => {
    const loadErrors = async () => {
      const stored = await getStoredErrors();
      setErrors(stored);
    };
    loadErrors();

    const listener = (changes: Record<string, browser.Storage.StorageChange>) => {
      if (ERRORS_STATE_KEY in changes) {
        const newState = changes[ERRORS_STATE_KEY].newValue as { errors: AppError[] } | undefined;
        setErrors(newState?.errors ?? []);
      }
    };

    browser.storage.local.onChanged.addListener(listener);
    return () => browser.storage.local.onChanged.removeListener(listener);
  }, []);

  // LAST_MERGE_TIME_KEY is stamped only by the background worker's merge
  // writes, never by this hook's own saves - an unambiguous "reload" signal
  // that a page-count comparison couldn't give us (it misses in-place edits).
  useEffect(() => {
    const listener = (changes: Record<string, browser.Storage.StorageChange>) => {
      if (LAST_MERGE_TIME_KEY in changes) {
        log("SETTINGS: Detected changes merged in from sync storage, reloading", "info");
        retrieveSettings();
      }
    };

    browser.storage.local.onChanged.addListener(listener);
    return () => browser.storage.local.onChanged.removeListener(listener);
  }, [retrieveSettings]);

  const clearErrors = useCallback(async (category?: AppError["category"]) => {
    await clearStoredErrors(category);
    const stored = await getStoredErrors();
    setErrors(stored);
  }, []);

  const injectError = useCallback(async (category?: ErrorCategory) => {
    await injectTestError(category);
    const stored = await getStoredErrors();
    setErrors(stored);
  }, []);

  return {
    pages: pagesData.pages,
    selectedPage: pagesData.selectedPage,
    darkModeEnabled,
    syncEnabled,
    isSaving: isSavingRef.current,
    errors,
    clearErrors,
    injectError,
    addPage,
    removePage,
    updatePage,
    addHeader,
    removeHeader,
    updateHeader,
    saveHeaders,
    addFilter,
    removeFilter,
    updateFilter,
    clear,
    changeSelectedPage,
    changePageIndex,
    importSettings,
    toggleDarkMode,
    toggleSync,
  };
}

export default useFlexHeaderSettings;
