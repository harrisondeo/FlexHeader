import { useEffect, useState, useCallback, useRef } from "react";
import { useAlert } from "../context/alertContext";
import browser from "webextension-polyfill";
import { SELECTED_PAGE_KEY, SETTINGS_KEY, SETTINGS_V3_META_KEY, PAGE_KEY_PREFIX, SETTINGS_SAVE_DEBOUNCE_TIME } from "../constants";

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
 * Custom hook for debouncing function calls
 * @param callback The function to debounce
 * @param delay The delay in milliseconds
 * @returns A debounced version of the callback
 */
const useDebounce = <T extends (...args: any[]) => any>(callback: T, delay: number) => {
  const timeoutRef = useRef<number | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

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

export const clearStoredSettings = () => {
  browser.storage.sync.clear();
};

function useFlexHeaderSettings() {
  const [lastError, setLastError] = useState<{ type: SettingsErrorType; time: number }>({ type: SettingsErrorType.None, time: 0 });
  const [pagesData, setPagesData] = useState<PagesData>({
    pages: [defaultPage],
    selectedPage: defaultPage.id,
  });
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const alertContext = useAlert();

  /**
   * Clears extra page storage items that are no longer needed
   * @param currentPageCount The current number of pages
   */
  const clearExtraPages = useCallback(async (currentPageCount: number) => {
    // Get all storage keys to find orphaned page entries
    try {
      const allData = await browser.storage.sync.get(null);
      const pageKeys = Object.keys(allData).filter(key => key.startsWith(PAGE_KEY_PREFIX));

      // Remove any page keys that exceed the current page count
      const keysToRemove = pageKeys.filter(key => {
        const pageIndex = parseInt(key.replace(PAGE_KEY_PREFIX, ''));
        return pageIndex >= currentPageCount;
      });

      // Only make the storage API call if we have keys to remove
      if (keysToRemove.length > 0) {
        console.log(`Clearing ${keysToRemove.length} extra page keys:`, keysToRemove);
        await browser.storage.sync.remove(keysToRemove);
      }
    } catch (error) {
      console.error("Error clearing extra pages:", error);
      // Don't throw the error to avoid breaking the save process
    }
  }, []);

  /**
   * Saves a single page to storage
   * @param page The page to save
   * @param pageIndex The index of the page
   */
  const savePage = useCallback(async (page: Page, pageIndex: number) => {
    const pageKey = `${PAGE_KEY_PREFIX}${pageIndex}`;
    const serializedPage = JSON.stringify(page);
    const sizeInBytes = new TextEncoder().encode(serializedPage).length;
    const STORAGE_LIMIT = 8192; // Chrome sync storage limit per item (8KB)

    if (sizeInBytes > STORAGE_LIMIT) {
      alertContext.setAlert({
        alertType: "error",
        alertText: `Page too large (${(sizeInBytes / 1024).toFixed(1)}KB > 8KB). Please reduce the number of headers on this page.`,
        location: "bottom",
      });
      throw new Error(`Page ${pageIndex} exceeds storage limit: ${sizeInBytes} bytes > ${STORAGE_LIMIT} bytes`);
    }

    await browser.storage.sync.set({ [pageKey]: page });
  }, [alertContext]);

  /**
   * Saves metadata to storage
   * @param meta The metadata to save
   */
  const saveMetadata = useCallback(async (meta: SettingsV3Meta) => {
    await browser.storage.sync.set({ [SETTINGS_V3_META_KEY]: meta });
  }, []);

  /**
   * Saves all pages and metadata to storage
   * @param settings The complete settings data
   */
  const save = useCallback(async (settings: PagesData, callback?: () => void) => {
    try {
      // Set the saving flag to prevent triggering additional saves
      isSavingRef.current = true;

      // Save each page individually
      const savePromises = settings.pages.map((page, index) => savePage(page, index));
      await Promise.all(savePromises);

      // Save metadata
      const metadata: SettingsV3Meta = {
        version: 3,
        selectedPage: settings.selectedPage,
        pageCount: settings.pages.length,
      };
      await saveMetadata(metadata);

      // Clear any extra pages that might exist from a previous state
      await clearExtraPages(settings.pages.length);

      if (callback) {
        callback();
      }
      // On success, clear error
      setLastError({ type: SettingsErrorType.None, time: 0 });
    } catch (error) {
      console.error("Failed to save settings:", error);
      setLastError({ type: SettingsErrorType.SaveError, time: Date.now() });
      alertContext.setAlert({
        alertType: "error",
        alertText: "Failed to save settings. Please try again.",
        location: "bottom",
      });
    } finally {
      // Reset the saving flag
      setTimeout(() => {
        isSavingRef.current = false;
      }, SETTINGS_SAVE_DEBOUNCE_TIME * 2); // Wait twice the debounce time to ensure no overlapping saves
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

  // Create a debounced version of the save function
  const debouncedSave = useDebounce((settings: PagesData) => {
    if (!hasInitialized) return;
    if (isSavingRef.current) {
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

    setIsSaving(true);
    save(settings, () => {
      setIsSaving(false);
    });
  }, SETTINGS_SAVE_DEBOUNCE_TIME);

  // Use a ref to track if we're currently in a save operation to prevent loops
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (!hasInitialized || isSavingRef.current) return;
    debouncedSave(pagesData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesData, hasInitialized, debouncedSave]);

  /**
   * Loads the settings from storage and sets the state
   */
  const retrieveSettings = useCallback(async () => {
    // Load dark mode setting
    try {
      const darkModeData = await browser.storage.sync.get("darkMode");
      if (darkModeData.darkMode === undefined) {
        await browser.storage.sync.set({ darkMode: false });
      } else {
        setDarkModeEnabled(darkModeData.darkMode === true);
      }
    } catch (error) {
      console.error("Failed to load dark mode setting:", error);
    }

    try {
      // Check if we have the new v3 format
      const metaData = await browser.storage.sync.get(SETTINGS_V3_META_KEY);

      if (metaData[SETTINGS_V3_META_KEY]) {
        // Load from new distributed storage format
        const meta = metaData[SETTINGS_V3_META_KEY] as SettingsV3Meta;

        // Load all pages
        const pagePromises = [];
        for (let i = 0; i < meta.pageCount; i++) {
          pagePromises.push(browser.storage.sync.get(`${PAGE_KEY_PREFIX}${i}`));
        }

        const pageResults = await Promise.all(pagePromises);
        const pages: Page[] = pageResults.map((result, index) => {
          const pageKey = `${PAGE_KEY_PREFIX}${index}`;
          const page = result[pageKey] as Page;

          // Ensure backwards compatibility for headerType
          if (page && page.headers) {
            page.headers = page.headers.map((h: any) => ({
              ...h,
              headerType: h.headerType || "request",
            }));
          }

          return page;
        }).filter(Boolean); // Remove any null/undefined pages

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
        }

        setHasInitialized(true);
        return;
      }

      // Check for legacy v2 format and migrate
      const v2Data = await browser.storage.sync.get(SETTINGS_KEY);

      if (v2Data[SETTINGS_KEY]) {
        console.log("Migrating from v2 to v3 storage format");
        const oldData = v2Data[SETTINGS_KEY] as PagesData;

        // Migrate to new format
        await save(oldData);

        // Remove old storage format
        await browser.storage.sync.remove(SETTINGS_KEY);

        // Set the migrated data
        setPagesData(oldData);
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
  }, []);

  /**
   * Clears the storage and sets the state to the default page
   */
  const clear = () => {
    browser.storage.sync.clear();
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
  const toggleDarkMode = () => {
    browser.storage.sync.get("darkMode").then((data) => {
      const darkMode = data.darkMode === undefined ? false : !data.darkMode;
      browser.storage.sync.set({ darkMode });
      setDarkModeEnabled(darkMode);
    });
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
    browser.storage.sync.set({ [SELECTED_PAGE_KEY]: pagesData.selectedPage });
  }, [pagesData.selectedPage]);

  return {
    pages: pagesData.pages,
    selectedPage: pagesData.selectedPage,
    darkModeEnabled,
    isSaving,
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
