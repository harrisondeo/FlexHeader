import type { Dispatch, SetStateAction } from "react";
import type { AlertContextType } from "../context/alertContext";
import type { Page, PagesData } from "./schemas";
import { createTombstone, synthesizeFallbackPage, type PageTombstone } from "./pageMerge";

interface UsePageOperationsParams {
  pagesData: PagesData;
  setPagesData: Dispatch<SetStateAction<PagesData>>;
  setTombstones: Dispatch<SetStateAction<PageTombstone[]>>;
  defaultPage: Page;
  alertContext: AlertContextType;
  recordHistory: (debounceKey: string | null) => void;
}

/**
 * Page CRUD (add/remove/update/select/reorder) for the currently loaded
 * pagesData. Extracted out of useFlexHeaderSettings; still needs tombstones
 * (removePage) and the default-page template (removePage's empty-list
 * fallback) since those are page-identity concerns, not just pagesData
 * transforms.
 */
function usePageOperations({
  pagesData,
  setPagesData,
  setTombstones,
  defaultPage,
  alertContext,
  recordHistory,
}: UsePageOperationsParams) {
  /**
   * INTERNAL ONLY - Update pages object to change the selected page
   * @param id
   * @param pages
   */
  const _changeSelectedPage = (id: number, pages: Page[]): Page[] =>
    pages.map((page) => ({
      ...page,
      enabled: page.id === id,
    }));

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
        // Always mint a fresh identity, even if the caller's page object
        // still carries one (e.g. a duplicated page) - addPage always
        // creates a distinct page, and reusing an existing pageId here is
        // exactly the bug class that made a duplicated page get merged back
        // into the original on another synced browser instead of appearing
        // as a separate page.
        pageId: crypto.randomUUID(),
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
    recordHistory(`page:${page.id}`);

    const newPages = pagesData.pages.map((p) => (p.id === page.id ? { ...page, lastModified: Date.now() } : p));

    setPagesData((prev) => ({
      ...prev,
      pages: newPages,
    }));
  };

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

  return { addPage, removePage, updatePage, changeSelectedPage, changePageIndex };
}

export default usePageOperations;
