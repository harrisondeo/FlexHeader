import { useEffect, useState, useCallback, useRef } from "react";
import { useAlert } from "../context/alertContext";
import browser from "webextension-polyfill";
import { SELECTED_PAGE_KEY, SETTINGS_KEY, SETTINGS_V3_META_KEY, PAGE_KEY_PREFIX } from "../constants";
import { saveToStorage, loadFromStorage, clearStorage, getAllFromStorage, getDataSizeInBytes } from "./storage";
import { log } from "./log";

export enum SettingsErrorType {
  None = "None",
  SaveError = "SaveError",
}

export type Page = {
  id: number;
  name: string;
  enabled: boolean;
  keepEnabled: boolean;
  filters: HeaderFilter[];
  headers: HeaderSetting[];
};

export type FilterType = "include" | "exclude";

export type HeaderFilter = {
  id: string;
  enabled: boolean;
  valid: boolean;
  type: FilterType;
  value: string;
};

export type HeaderSetting = {
  id: string;
  headerName: string;
  headerValue: string;
  headerEnabled: boolean;
  headerType: "request" | "response";
};

export type PagesData = {
  pages: Page[];
  selectedPage: number;
};

export type SettingsV3Meta = {
  version: 3;
  selectedPage: number;
  pageCount: number;
};

/**
 * The debouncing logic has been moved into the component to allow access to the timeout ref
 * for handling window unload events
 */

const defaultPage: Page = {
  id: 0,
  name: "Default",
  enabled: true,
  keepEnabled: false,
  filters: [],
  headers: [
    {
      id: "default-1",
      headerName: "X-Frame-Options",
      headerValue: "ALLOW-FROM https://www.youtube.com/",
      headerEnabled: true,
      headerType: "request",
    },
  ],
};

const filterIsValid = async (
  filter: Omit<HeaderFilter, "valid">,
  callback: (valid: boolean) => void
) => {
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
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const isSavingRef = useRef<boolean>(false);

  const alertContext = useAlert();

  /**
   * Handles saving data to local storage and manages cleanup of extra pages
   * Syncing to remote storage is now handled by the background service worker
   * @param settings The complete settings data
   */
  const saveToStorages = useCallback(async (settings: PagesData) => {
    try {
      // Create metadata
      const metadata: SettingsV3Meta = {
        version: 3,
        selectedPage: settings.selectedPage,
        pageCount: settings.pages.length,
      };

      try {
        log(`SETTINGS: Saving to local storage`, "warning");

        // Save all pages in parallel
        const savePromises = settings.pages.map((page, index) => {
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

          return saveToStorage(pageKey, page, 'local');
        });

        // Save metadata alongside pages
        const metadataPromise = saveToStorage(SETTINGS_V3_META_KEY, metadata, 'local');

        // Wait for all saves to complete
        await Promise.all([...savePromises, metadataPromise]);

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

        // Update timestamps for local changes
        await saveToStorage('localModifiedTime', Date.now(), 'local');

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
    if (!hasInitialized || isSavingRef.current) return;

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
    saveToStorages(settingsToSave)
      .finally(() => {
        setTimeout(() => {
          isSavingRef.current = false;
          log("SETTINGS: Changes saved successfully", "success");
        }, 0);
      });
  }, [pagesData, hasInitialized, lastError, saveToStorages, alertContext]);

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

        const pagesWithNulls = await Promise.all(pagePromises);
        const pages: Page[] = pagesWithNulls
          .filter((page): page is Page => page !== null) // Remove any null/undefined pages with type guard
          .map((page) => {
            if (page && page.headers) {
              // Ensure backwards compatibility for headerType
              return {
                ...page,
                headers: page.headers.map((h: any) => ({
                  ...h,
                  headerType: h.headerType || "request",
                }))
              };
            }
            return page;
          });

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
          });      // If loaded from sync, save a copy to local storage
          if (storageType === 'sync') {
            log("SETTINGS: Saving sync data to local storage", "info");
            // Save to local storage
            await saveToStorages({
              pages,
              selectedPage: meta.selectedPage,
            });
          }
        }

        setHasInitialized(true);
        return;
      }

      // Check for legacy v2 format and migrate
      const v2Data = await loadFromStorage<PagesData | null>(SETTINGS_KEY, null, ['sync']);

      if (v2Data) {
        log("SETTINGS: Migrating from v2 to v3 storage format", "info");

        // Migrate to new format - only save to local storage, background will handle sync
        await saveToStorages(v2Data);

        // Remove old storage format
        await browser.storage.sync.remove(SETTINGS_KEY);

        // Set the migrated data
        setPagesData(v2Data);
        setHasInitialized(true);
        return;
      }

      // No existing settings found, use default
      setPagesData({
        pages: [defaultPage],
        selectedPage: defaultPage.id,
      });
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
      { ...page, id: pagesData.pages.length, enabled: true },
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
    let newPages = pagesData.pages.filter((page) => page.id !== id);

    // if there are no pages left after removing the page, add the default page
    if (newPages.length === 0) {
      newPages.push(defaultPage);
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
    const newPages = pagesData.pages.map((p) => (p.id === page.id ? page : p));

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
          headers: [
            ...page.headers,
            {
              ...header,
              headerType: header.headerType || "request",
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
      page.id === pageId ? { ...page, headers: reIndexedHeaders } : page
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
   * Import json file
   */
  const importSettings = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;

      if (typeof result === "string") {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          // remap the ids to avoid conflicts
          const combinedPages = [...pagesData.pages, ...parsed];
          const newPages = combinedPages.map((page: any, index) => {
            return {
              ...page,
              id: index,
              headers: page.headers.map((h: any) => ({
                ...h,
                headerType: h.headerType ? h.headerType : "request",
              })),
            };
          });

          setPagesData((prev) => ({
            ...prev,
            pages: newPages,
          }));

          alertContext.setAlert({
            alertType: "info",
            alertText: "Settings imported.",
            location: "bottom",
          });
        }
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    retrieveSettings();
  }, [retrieveSettings]);

  useEffect(() => {
    // Only save to local storage, background service worker will handle syncing
    saveToStorage(SELECTED_PAGE_KEY, pagesData.selectedPage, 'local')
      .catch(err => console.error("Failed to save selected page to local storage:", err));
  }, [pagesData.selectedPage]);

  return {
    pages: pagesData.pages,
    selectedPage: pagesData.selectedPage,
    darkModeEnabled,
    isSaving: isSavingRef.current,
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
  };
}

export default useFlexHeaderSettings;
