import type { Dispatch, SetStateAction } from "react";
import type { PagesData, HeaderSetting } from "../domain/schemas";

interface UseHeaderOperationsParams {
  pagesData: PagesData;
  setPagesData: Dispatch<SetStateAction<PagesData>>;
  recordHistory: (debounceKey: string | null) => void;
}

/**
 * Header CRUD for the currently loaded pagesData. Extracted out of
 * useFlexHeaderSettings since these are pure pagesData transforms with no
 * dependency on the rest of the hook's state.
 */
function useHeaderOperations({ pagesData, setPagesData, recordHistory }: UseHeaderOperationsParams) {
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
    recordHistory(null);

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
    recordHistory(`header:${pageId}:${header.id}`);

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

  return { addHeader, removeHeader, saveHeaders, updateHeader };
}

export default useHeaderOperations;
