import { useEffect, useState } from "react";
import { useAlert } from "../context/alertContext";
import browser from "webextension-polyfill";
import { SELECTED_PAGE_KEY, SETTINGS_KEY } from "../constants";

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
};

export type PagesData = {
  pages: Page[];
  selectedPage: number;
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
  const [pagesData, setPagesData] = useState<PagesData>({
    pages: [defaultPage],
    selectedPage: defaultPage.id,
  });
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const alertContext = useAlert();

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

  useEffect(() => {
    if (!hasInitialized) return;

    save(pagesData);
  }, [pagesData, hasInitialized]);

  /**
   * Loads the settings from storage and sets the state
   */
  const retrieveSettings = async () => {
    // if storage does not have "settings_v2" then we need to migrate the old settings
    browser.storage.sync.get(SETTINGS_KEY).then((data) => {
      // Migration
      if (data[SETTINGS_KEY] === undefined) {
        let oldSettings: PagesData = {
          pages: [],
          selectedPage: 0,
        };

        browser.storage.sync.get("settings").then((data) => {
          if (data.settings === undefined || !Array.isArray(data.settings)) {
            // no new settings, no old settings, set to default
            oldSettings.pages = [defaultPage];

            setPagesData(oldSettings);
            setHasInitialized(true);

            return;
          }

          oldSettings.pages = data.settings.sort((a: Page, b: Page) => {
            return a.id - b.id;
          });

          browser.storage.sync.get(SELECTED_PAGE_KEY).then((data) => {
            if (data[SELECTED_PAGE_KEY] === undefined) {
              oldSettings.selectedPage = 0;
              return;
            }

            oldSettings.selectedPage = data[SELECTED_PAGE_KEY] as number;

            browser.storage.sync
              .set({ [SETTINGS_KEY]: oldSettings })
              .then(() => {
                console.log("Migrated old settings to new format");
                browser.storage.sync.remove([SETTINGS_KEY, SELECTED_PAGE_KEY]);
                setPagesData(oldSettings);
                setHasInitialized(true);
              });
          });
        });
      } else {
        setPagesData(data[SETTINGS_KEY] as PagesData);
        setHasInitialized(true);
      }
    });

    browser.storage.sync.get("darkMode").then((data) => {
      if (data.darkMode === undefined) {
        browser.storage.sync.set({
          darkMode: false,
        });
        return;
      }

      setDarkModeEnabled(data.darkMode === true);
    });
  };

  /**
   * Saves pages array to storage
   * @param pages The pages to save to storage
   */
  const save = (settings: PagesData, callback?: () => void) => {
    browser.storage.sync.set({ [SETTINGS_KEY]: settings }).then(() => {
      if (callback) {
        callback();
      }
    });
  };

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

    setPagesData({
      pages: newPages,
      selectedPage: newPages.length - 1,
    });
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
          const newPages = combinedPages.map((page, index) => {
            return {
              ...page,
              id: index,
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
  }, []);

  useEffect(() => {
    browser.storage.sync.set({ [SELECTED_PAGE_KEY]: pagesData.selectedPage });
  }, [pagesData.selectedPage]);

  return {
    pages: pagesData.pages,
    selectedPage: pagesData.selectedPage,
    darkModeEnabled,
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
