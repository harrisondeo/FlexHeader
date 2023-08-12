import { useEffect, useState } from "react";

export type Page = {
  id: string;
  name: string;
  enabled: boolean;
  filters: HeaderFilter[];
  headers: HeaderSetting[];
};

export type HeaderFilter = {
  id: string;
  enabled: boolean;
  valid: boolean;
  type: "include" | "exclude";
  value: string;
};

export type HeaderSetting = {
  id: string;
  headerName: string;
  headerValue: string;
  headerEnabled: boolean;
};

const defaultPage: Page = {
  id: "default",
  name: "Default",
  enabled: true,
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

const filterIsValid = (filter: Omit<HeaderFilter, "valid">) => {
  // check that value is valid regex
  try {
    new RegExp(filter.value);
    return true;
  } catch (e) {
    return false;
  }
};

function useFlexHeaderSettings() {
  const [pages, setPages] = useState<Page[]>([defaultPage]);

  const retrieveSettings = async () => {
    chrome.storage.sync.get("settings", (data) => {
      console.log("retrieved settings", data.settings);
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

      setPages(data.settings);
    });
  };

  const save = (pages: Page[]) => {
    chrome.storage.sync.set({ settings: pages });
  };

  const clear = () => {
    chrome.storage.sync.clear();
    setPages([defaultPage]);
  };

  /**
   * Page functions
   */
  const addPage = (page: Page) => {
    const newPages = [...pages, page];
    setPages(newPages);
    save(newPages);
  };

  const removePage = (pageId: string) => {
    const newPages = pages.filter((page) => page.id !== pageId);
    setPages(newPages);
    save(newPages);
  };

  const updatePage = (page: Page) => {
    const newPages = pages.map((p) => {
      if (p.id === page.id) {
        return page;
      }
      return p;
    });
    setPages(newPages);
    save(newPages);
  };

  /**
   * Header functions
   */
  const addHeader = (pageId: string, header: Omit<HeaderSetting, "id">) => {
    const newPages = pages.map((page) => {
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
    console.log(newPages);
    setPages(newPages);
    save(newPages);
  };

  const removeHeader = (pageId: string, id: string) => {
    const newPages = pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          headers: page.headers.filter((header) => header.id !== id),
        };
      }
      return page;
    });
    setPages(newPages);
    save(newPages);
  };

  const updateHeader = (pageId: string, header: HeaderSetting) => {
    const newPages = pages.map((page) => {
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
    setPages(newPages);
    save(newPages);
  };

  /**
   * Filter functions
   */
  const addFilter = (pageId: string, filter: Omit<HeaderFilter, "id">) => {
    const newPages = pages.map((page) => {
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
    setPages(newPages);
    save(newPages);
  };

  const removeFilter = (pageId: string, filterId: string) => {
    const newPages = pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,
          filters: page.filters.filter((filter) => filter.id !== filterId),
        };
      }
      return page;
    });
    setPages(newPages);
    save(newPages);
  };

  const updateFilter = (
    pageId: string,
    filter: Omit<HeaderFilter, "valid">
  ) => {
    const newPages = pages.map((page) => {
      if (page.id === pageId) {
        return {
          ...page,

          filters: page.filters.map((f) => {
            if (f.id === filter.id) {
              return {
                ...filter,
                valid: filterIsValid(filter),
              };
            }
            return f;
          }),
        };
      }
      return page;
    });
    setPages(newPages);
    save(newPages);
  };

  useEffect(() => {
    retrieveSettings();
  }, []);

  return {
    pages,
    addPage,
    removePage,
    updatePage,
    addHeader,
    removeHeader,
    updateHeader,
    addFilter,
    removeFilter,
    updateFilter,
    clear,
  };
}

export default useFlexHeaderSettings;
