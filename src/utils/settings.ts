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
  chrome.declarativeNetRequest.isRegexSupported(
    {
      regex: filter.value,
    },
    (result) => {
      callback(result.isSupported);
    }
  );
};

export const clearStoredSettings = () => {
  chrome.storage.sync.clear();
};

function useFlexHeaderSettings() {
  const [pages, setPages] = useState<Page[]>([defaultPage]);
  const [selectedPage, setSelectedPage] = useState<number>(0);

  const alertContext = useAlert();

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

      setPages(data.settings);
    });

    chrome.storage.sync.get("selectedPage", (data) => {
      if (data.selectedPage === undefined) {
        chrome.storage.sync.set({
          selectedPage: 0,
        });
        return;
      }

      setSelectedPage(data.selectedPage);
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
    const currentPages = pages.map((p) => {
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

    setPages(newPages);
    save(newPages);
  };

  const removePage = (id: number) => {
    const newPages = pages.filter((page) => page.id !== id);

    // if there are no pages left after removing the page, add the default page
    if (newPages.length === 0) {
      newPages.push(defaultPage);
    }

    newPages.forEach((page, index) => {
      page.id = index;
    });

    setPages(newPages);
    save(newPages);
    alertContext.setAlert({
      alertType: "info",
      alertText: "Page removed.",
      location: "bottom",
    });
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

  const changeSelectedPage = (id: number) => {
    // set all pages except the selected one to disabled
    const newPages = pages.map((page) => {
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
    setPages(newPages);
    save(newPages);
    setSelectedPage(id);
  };

  const changePageIndex = (oldIndex: number, newIndex: number) => {
    const newPages = [...pages];
    const [removed] = newPages.splice(oldIndex, 1);

    if (newIndex < 0) newIndex = 0;

    newPages.splice(newIndex, 0, removed);

    newPages.forEach((page, index) => {
      page.id = index;
    });

    setSelectedPage(newIndex);
    setPages(newPages);
    save(newPages);
  };

  /**
   * Header functions
   */
  const addHeader = (pageId: number, header: Omit<HeaderSetting, "id">) => {
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
    setPages(newPages);
    save(newPages);
  };

  const removeHeader = (pageId: number, id: string) => {
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

  const updateHeader = (pageId: number, header: HeaderSetting) => {
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
  const addFilter = (pageId: number, filter: Omit<HeaderFilter, "id">) => {
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

  const removeFilter = (pageId: number, filterId: string) => {
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
    pageId: number,
    filter: Omit<HeaderFilter, "valid">
  ) => {
    filterIsValid(filter, (result) => {
      const newPages = pages.map((page) => {
        if (page.id === pageId) {
          return {
            ...page,

            filters: page.filters.map((f) => {
              if (f.id === filter.id) {
                return {
                  ...filter,
                  valid: result,
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
    });
  };

  /**
   * Import json file
   */
  const importSettings = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      console.log("Result", result);
      if (typeof result === "string") {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          // remap the ids to avoid conflicts
          const combinedPages = [...pages, ...parsed];
          const newPages = combinedPages.map((page, index) => {
            return {
              ...page,
              id: index,
            };
          });

          setPages(newPages);
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
    chrome.storage.sync.set({ selectedPage: selectedPage });
  }, [selectedPage]);

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
    selectedPage,
    changeSelectedPage,
    changePageIndex,
    importSettings,
  };
}

export default useFlexHeaderSettings;
