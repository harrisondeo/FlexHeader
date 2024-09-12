import { useEffect, useState } from "react";
import { useAlert } from "../context/alertContext";

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
    chrome.declarativeNetRequest.isRegexSupported(
      {
        regex: filter.value,
      },
      (result) => {
        callback(result.isSupported);
      }
    );
  } catch (error) {
    callback(false);
  }
};

export const clearStoredSettings = () => {
  chrome.storage.sync.clear();
};

function useFlexHeaderSettings() {
  const [pagesData, setPagesData] = useState<{
    pages: Page[];
    selectedPage: number;
  }>({
    pages: [defaultPage],
    selectedPage: defaultPage.id,
  });
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  const alertContext = useAlert();

  useEffect(() => {
    const selectedPage = pagesData.pages.find((page) => page.enabled);
    if (selectedPage) {
      const activeHeaders = selectedPage.headers.filter(
        (header) => header.headerEnabled
      );
      chrome.action.setBadgeText({
        text: activeHeaders.length.toString(),
      });
    } else {
      chrome.action.setBadgeText({
        text: "",
      });
    }
  }, [pagesData]);

  /**
   * Loads the settings from storage and sets the state
   */
  const retrieveSettings = async () => {
    chrome.storage.sync.get("settings", (data) => {
      if (data.settings === undefined) {
        chrome.storage.sync.set({
          settings: [defaultPage],
        });
        return;
      }

      if (!Array.isArray(data.settings)) {
        chrome.storage.sync.set({
          settings: [defaultPage],
        });
        return;
      }
      console.log("found settings", data.settings);

      data.settings.sort((a: Page, b: Page) => {
        return a.id - b.id;
      });

      setPagesData({
        pages: data.settings,
        selectedPage: data.settings.findIndex((page: Page) => page.enabled),
      });
    });

    chrome.storage.sync.get("selectedPage", (data) => {
      if (data.selectedPage === undefined) {
        chrome.storage.sync.set({
          selectedPage: 0,
        });
        return;
      }

      setPagesData((prev) => {
        return {
          ...prev,
          selectedPage: data.selectedPage,
        };
      });
    });

    chrome.storage.sync.get("darkMode", (data) => {
      if (data.darkMode === undefined) {
        chrome.storage.sync.set({
          darkMode: false,
        });
        return;
      }

      setDarkModeEnabled(data.darkMode);
    });
  };

  /**
   * Saves pages array to storage
   * @param pages The pages to save to storage
   */
  const save = (pages: Page[], callback?: () => void) => {
    chrome.storage.sync.set({ settings: pages }).then(() => {
      if (callback) {
        callback();
      }
    });
  };

  /**
   * Clears the storage and sets the state to the default page
   */
  const clear = () => {
    chrome.storage.sync.clear();
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
    const currentPages = pagesData.pages.map((p) => {
      return {
        ...p,
        enabled: false,
      };
    });
    const newPages = [
      ...currentPages,
      {
        ...page,
        id: currentPages.length,
        enabled: true,
      },
    ];

    save(newPages);
    setPagesData({
      pages: newPages,
      selectedPage: newPages[newPages.length - 1].id,
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

    newPages.forEach((page, index) => {
      page.id = index;
    });

    const newPageId = autoSelectPage
      ? newPages[newPages.length - 1].id
      : pagesData.selectedPage;

    newPages = _changeSelectedPage(newPageId, newPages);
    save(newPages);
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
    const newPages = pagesData.pages.map((p) => {
      if (p.id === page.id) {
        return page;
      }
      return p;
    });

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));

    save(newPages);
  };

  /**
   * INTERNAL ONLY - Update pages object to change the selected page
   * @param id
   * @param pages
   * @param save
   */
  const _changeSelectedPage = (id: number, pages: Page[]): Page[] => {
    // set all pages except the selected one to disabled
    return pages.map((page) => {
      if (page.id === id) {
        return {
          ...page,
          enabled: true,
        };
      }
      return {
        ...page,
        enabled: false,
      };
    });
  };

  /**
   * EXTERNAL - Used for external components to change the selected page
   * @param id The ID of the page to select
   */
  const changeSelectedPage = (id: number) => {
    let pagesToEdit = [...pagesData.pages];
    pagesToEdit = _changeSelectedPage(id, pagesToEdit);

    setPagesData({
      pages: pagesToEdit,
      selectedPage: id,
    });

    save(pagesToEdit);
  };

  const changePageIndex = (oldIndex: number, newIndex: number) => {
    const newPages = [...pagesData.pages];
    const [removed] = newPages.splice(oldIndex, 1);

    if (newIndex < 0) newIndex = 0;

    newPages.splice(newIndex, 0, removed);

    newPages.forEach((page, index) => {
      page.id = index;
    });

    setPagesData({
      pages: newPages,
      selectedPage: newIndex,
    });

    save(newPages);
  };

  /**
   * Header functions
   */

  /**
   * INTERNAL ONLY - Re-indexes the headers after one is removed or added
   * @param headers
   * @returns reindexed headers
   */
  const _reIndexHeaders = (headers: HeaderSetting[]) => {
    return headers.map((header, index) => {
      return {
        ...header,
        id: `${header.id.split("-")[0]}-${index + 1}`,
      };
    });
  };

  /**
   * Adds a new header to a given page
   * @param pageId The page that the header will be added to
   * @param header The header object to add
   */
  const addHeader = (pageId: number, header: Omit<HeaderSetting, "id">) => {
    const newPages = pagesData.pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          headers: [
            ...page.headers,
            {
              ...header,
              id: `${pageId}-${page.headers.length + 1}`,
            },
          ],
        };
      }
      return page;
    });

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));

    save(newPages);
    return newPages[pageId].headers[newPages[pageId].headers.length - 1];
  };

  /**
   * Removes a header from a given page
   * @param pageId The page that the header will be removed from
   * @param id The id of the header to remove
   */
  const removeHeader = (pageId: number, id: string) => {
    const newPages = pagesData.pages.map((page) => {
      if (page.id === pageId) {
        const filteredHeaders = page.headers.filter(
          (header) => header.id !== id
        );
        const reIndexedHeaders = _reIndexHeaders(filteredHeaders);

        return {
          ...page,
          headers: reIndexedHeaders,
        };
      }
      return page;
    });

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));

    save(newPages);
  };

  /**
   * Allows you to save the headers data after a change.
   * The function WILL re-index the headers to avoid conflicts
   * @param newHeaders | The new headers array to save
   * @param pageId | The page that the headers belong to
   */
  const saveHeaders = (newHeaders: HeaderSetting[], pageId: number) => {
    const reIndexedHeaders = _reIndexHeaders(newHeaders);

    const newPages = pagesData.pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          headers: reIndexedHeaders,
        };
      }
      return page;
    });

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));

    save(newPages);
  };

  /**
   * Updates the values of a header
   * @param pageId The page that the header belongs to
   * @param header The new header object, the id should match the header to update
   */
  const updateHeader = (pageId: number, header: HeaderSetting) => {
    const newPages = pagesData.pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          headers: page.headers.map((h) => {
            if (h.id === header.id) {
              return header;
            }
            return h;
          }),
        };
      }
      return page;
    });

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));

    save(newPages);
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
    const newPages = pagesData.pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          filters: [
            ...page.filters,
            {
              ...filter,
              id: `${pageId}-${page.filters.length + 1}`,
            },
          ],
        };
      }
      return page;
    });

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));

    save(newPages);
  };

  /**
   * Removes a filter from a page
   * @param pageId | The page that the filter belongs to
   * @param filterId | The id of the filter to remove
   */
  const removeFilter = (pageId: number, filterId: string) => {
    const newPages = pagesData.pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          filters: page.filters.filter((filter) => filter.id !== filterId),
        };
      }
      return page;
    });

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));

    save(newPages);
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
      const newPages = pagesData.pages.map((page) => {
        if (page.id !== pageId) return page;

        const updatedFilters = page.filters.map((f) =>
          f.id === filter.id ? { ...filter, valid: result } : f
        );

        return { ...page, filters: updatedFilters };
      });

      setPagesData((prev) => ({
        ...prev,
        pages: newPages,
      }));

      save(newPages);
    });
  };

  /**
   * Dark Mode
   */
  const toggleDarkMode = () => {
    chrome.storage.sync.get("darkMode", (data) => {
      const darkMode = data.darkMode === undefined ? false : !data.darkMode;
      chrome.storage.sync.set({ darkMode });
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

          save(newPages);

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
    chrome.storage.sync.set({ selectedPage: pagesData.selectedPage });
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
