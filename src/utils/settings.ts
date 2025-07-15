import { useEffect, useState, useCallback, useRef } from "react";
import { useAlert } from "../context/alertContext";
import browser from "webextension-polyfill";
import { SELECTED_PAGE_KEY, SETTINGS_KEY, SETTINGS_V3_META_KEY, PAGE_KEY_PREFIX, SETTINGS_SAVE_DEBOUNCE_TIME, LAST_SYNC_TIME_KEY, SYNC_INTERVAL } from "../constants";
import { saveToStorage, loadFromStorage, clearStorage, getAllFromStorage, saveMultipleToStorage, saveToBothStorages, getDataSizeInBytes } from "./storage";

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
   * Clears extra page storage items that are no longer needed
   * @param currentPageCount The current number of pages
   * @param storageType Which storage type to clear from
   */
  const clearExtraPages = useCallback(async (currentPageCount: number, storageType: 'local' | 'sync' | 'both' = 'both') => {
    const clearFromStorage = async (type: 'local' | 'sync') => {
      try {
        const allData = await getAllFromStorage(type);
        const pageKeys = Object.keys(allData).filter(key => key.startsWith(PAGE_KEY_PREFIX));

        // Remove any page keys that exceed the current page count
        const keysToRemove = pageKeys.filter(key => {
          const pageIndex = parseInt(key.replace(PAGE_KEY_PREFIX, ''));
          return pageIndex >= currentPageCount;
        });

        // Only make the storage API call if we have keys to remove
        if (keysToRemove.length > 0) {
          console.log(`Clearing ${keysToRemove.length} extra page keys from ${type} storage:`, keysToRemove);
          await browser.storage[type].remove(keysToRemove);
        }
      } catch (error) {
        console.error(`Error clearing extra pages from ${type} storage:`, error);
        // Don't throw the error to avoid breaking the save process
      }
    };

    if (storageType === 'both') {
      await Promise.all([clearFromStorage('local'), clearFromStorage('sync')]);
    } else {
      await clearFromStorage(storageType);
    }
  }, []);

  /**
   * Saves a single page to storage
   * @param page The page to save
   * @param pageIndex The index of the page
   * @param storageType Which storage type to use - local is faster, sync persists across devices
   */
  const savePage = useCallback(async (page: Page, pageIndex: number, storageType: 'local' | 'sync' = 'local') => {
    const pageKey = `${PAGE_KEY_PREFIX}${pageIndex}`;
    const sizeInBytes = getDataSizeInBytes(page);
    const STORAGE_LIMIT = storageType === 'sync' ? 8192 : 5242880; // 8KB for sync, 5MB for local

    if (sizeInBytes > STORAGE_LIMIT) {
      alertContext.setAlert({
        alertType: "error",
        alertText: `Page too large (${(sizeInBytes / 1024).toFixed(1)}KB > ${STORAGE_LIMIT / 1024}KB). Please reduce the number of headers on this page.`,
        location: "bottom",
      });
      throw new Error(`Page ${pageIndex} exceeds storage limit: ${sizeInBytes} bytes > ${STORAGE_LIMIT} bytes`);
    }

    try {
      await saveToStorage(pageKey, page, storageType);
    } catch (error) {
      console.error(`Failed to save page to ${storageType} storage:`, error);
      throw error;
    }
  }, []);

  /**
   * Saves metadata to storage
   * @param meta The metadata to save
   * @param storageType Which storage type to use
   */
  const saveMetadata = useCallback(async (meta: SettingsV3Meta, storageType: 'local' | 'sync' = 'local') => {
    try {
      await saveToStorage(SETTINGS_V3_META_KEY, meta, storageType);
    } catch (error) {
      console.error(`Failed to save metadata to ${storageType} storage:`, error);
      throw error;
    }
  }, []);

  /**
   * Saves all pages and metadata to storage
   * @param settings The complete settings data
   * @param storageType Which storage type to use
   * @param callback Optional callback after save completes
   */
  const save = useCallback(async (settings: PagesData, storageType: 'local' | 'sync' | 'both' = 'local', callback?: () => void) => {
    try {
      // Create metadata
      const metadata: SettingsV3Meta = {
        version: 3,
        selectedPage: settings.selectedPage,
        pageCount: settings.pages.length,
      };

      if (storageType === 'both') {
        // Save to local storage first (primary)
        const localSavePromises = settings.pages.map((page, index) => savePage(page, index, 'local'));
        await Promise.all(localSavePromises);
        await saveMetadata(metadata, 'local');

        // Then attempt to save to sync storage (secondary)
        try {
          const syncSavePromises = settings.pages.map((page, index) => savePage(page, index, 'sync'));
          await Promise.all(syncSavePromises);
          await saveMetadata(metadata, 'sync');

          // Update last sync time
          await saveToStorage(LAST_SYNC_TIME_KEY, Date.now(), 'local');
        } catch (syncError) {
          console.warn("Failed to sync to remote storage:", syncError);
        }
      } else {
        // Save to specified storage
        console.log(`SETTINGS: Saving pages to ${storageType} storage`);
        const savePromises = settings.pages.map((page, index) => savePage(page, index, storageType));
        await Promise.all(savePromises);
        console.log(`SETTINGS: Successfully saved pages to ${storageType} storage`);

        console.log(`SETTINGS: Saving metadata to ${storageType} storage`);
        await saveMetadata(metadata, storageType);
        console.log(`SETTINGS: Successfully saved metadata to ${storageType} storage`)
        // If saving to local, update the last modified time to track for future syncs
        if (storageType === 'local') {
          await saveToStorage('localModifiedTime', Date.now(), 'local');
        }
      }

      // Clear any extra pages that might exist from a previous state
      await clearExtraPages(settings.pages.length, storageType === 'both' ? 'both' : storageType);

      if (callback) {
        callback();
      }
      // On success, clear error
      setLastError({ type: SettingsErrorType.None, time: 0 });
    } catch (error) {
      console.error(`Failed to save settings to ${storageType} storage:`, error);
      setLastError({ type: SettingsErrorType.SaveError, time: Date.now() });
      alertContext.setAlert({
        alertType: "error",
        alertText: "Failed to save settings. Please try again.",
        location: "bottom",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alertContext is stable from context
  }, [savePage, saveMetadata, clearExtraPages]);

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

  // Direct save with periodic sync to sync storage
  const saveWithSync = useCallback(
    (settings: PagesData) => {
      if (!hasInitialized) return;
      if (isSavingRef.current === true) {
        console.log("Skipping save: already saving.");
        return;
      }

      // Prevent save retry if a save error was triggered within the last minute
      if (
        lastError.type === SettingsErrorType.SaveError &&
        Date.now() - lastError.time < 60 * 1000
      ) {
        console.warn("Skipping save: recent save error within last minute.");
        alertContext.setAlert({
          alertType: "error",
          alertText: "Changes not saved due to recent error. Please try again later.",
          location: "bottom",
        });
        return;
      }

      // Immediately save to local storage (no debounce)
      isSavingRef.current = true;
      console.log(
        `%cSETTINGS: Saving settings immediately to local storage`,
        "color: #d28b19ff; font-weight: bold;"
      );

      // Save the settings but ensure we don't trigger more state updates
      const settingsToSave = { ...settings }; // Create a copy to avoid reference issues
      save(settingsToSave, 'local', () => {
        // Use a timeout to ensure any pending state updates are processed before
        // we allow saving again
        setTimeout(() => {
          console.log("2) Setting isSavingRef to false");
          isSavingRef.current = false;
        }, 0);
      });
    },
    [hasInitialized, lastError, save]
  );

  // Set up periodic sync to sync storage
  useEffect(() => {
    if (!hasInitialized) return;

    // Function to sync local data to sync storage
    const syncToRemote = async () => {
      // Skip sync if we're already in the middle of a save operation
      if (isSavingRef.current === true) {
        console.log("Skipping sync: already in a save operation");
        return;
      }

      try {
        console.log(
          "%cSETTINGS: Syncing local data to sync storage",
          "color: #d2193eff; font-weight: bold;"
        );
        isSavingRef.current = true;

        // Get current data from local storage
        const meta = await loadFromStorage<SettingsV3Meta | null>(SETTINGS_V3_META_KEY, null, ['local']);
        if (!meta) {
          console.log("No local metadata found, skipping sync");
          return;
        }

        // Load all pages from local storage
        const pagePromises = [];
        for (let i = 0; i < meta.pageCount; i++) {
          const pageKey = `${PAGE_KEY_PREFIX}${i}`;
          pagePromises.push(loadFromStorage<Page | null>(pageKey, null, ['local']));
        }

        const pagesWithNulls = await Promise.all(pagePromises);
        const pages: Page[] = pagesWithNulls
          .filter((page): page is Page => page !== null);          // Sync to remote storage
        if (pages.length > 0) {
          // Create a new object to avoid any reference issues
          const dataToSync = {
            pages: JSON.parse(JSON.stringify(pages)),
            selectedPage: meta.selectedPage
          };

          await save(dataToSync, 'sync');

          // Update last sync time
          await saveToStorage(LAST_SYNC_TIME_KEY, Date.now(), 'local');
        }
      } catch (error) {
        console.error("Failed to sync to remote storage:", error);
      } finally {
        console.log("3) Setting isSavingRef to false");
        isSavingRef.current = false;
      }
    };

    // Initial sync when component loads
    syncToRemote();

    // Set up interval for periodic sync
    const syncInterval = setInterval(syncToRemote, SYNC_INTERVAL);

    return () => {
      clearInterval(syncInterval);
    };
  }, [hasInitialized, save]);

  // Create a ref to track the previous pages data to prevent unnecessary saves
  const prevPagesDataRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSavingRef.current === true) {
      console.log("Skipping save: already saving.");
      return;
    }
    if (!hasInitialized) return;

    // Stringify current data for comparison
    const currentDataString = JSON.stringify(pagesData);

    // Only save if the data has actually changed
    if (prevPagesDataRef.current === currentDataString) {
      console.log("Skipping save: data hasn't changed");
      return;
    }

    // Update the ref with current data string
    prevPagesDataRef.current = currentDataString;

    console.log("OO) Saving pages data with sync");
    saveWithSync(pagesData);
  }, [pagesData, hasInitialized, saveWithSync]);

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
        console.log(
          `%cSETTINGS: Loading settings from ${storageType} storage`,
          "color: #d28b19ff; font-weight: bold;"
        );
        // Load from distributed storage format

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
          });

          // If loaded from sync, save a copy to local storage
          if (storageType === 'sync') {
            console.log("Saving sync data to local storage");
            // Use the save function to save this data to local storage
            await save({
              pages,
              selectedPage: meta.selectedPage,
            }, 'local');
          }
        }

        setHasInitialized(true);
        return;
      }

      // Check for legacy v2 format and migrate
      const v2Data = await loadFromStorage<PagesData | null>(SETTINGS_KEY, null, ['sync']);

      if (v2Data) {
        console.log("Migrating from v2 to v3 storage format");

        // Migrate to new format
        await save(v2Data, 'both');

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
  }, [save]);

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
    console.log("Removing page", id, "new pages:", newPages);
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

      // Save to both storage types
      await saveToStorage("darkMode", newDarkMode, 'local');

      try {
        await saveToStorage("darkMode", newDarkMode, 'sync');
      } catch (err) {
        console.warn("Failed to sync dark mode to sync storage:", err);
      }

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
    saveToStorage(SELECTED_PAGE_KEY, pagesData.selectedPage, 'local');

    // Also update in sync storage, but don't worry if it fails
    saveToStorage(SELECTED_PAGE_KEY, pagesData.selectedPage, 'sync')
      .catch(err => console.warn("Failed to sync selected page to sync storage:", err));
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
