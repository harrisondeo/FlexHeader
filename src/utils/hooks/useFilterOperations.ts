import type { Dispatch, SetStateAction } from "react";
import type { PagesData, HeaderFilter } from "../domain/schemas";
import { filterIsValid } from "../domain/filterValidation";

interface UseFilterOperationsParams {
  pagesData: PagesData;
  setPagesData: Dispatch<SetStateAction<PagesData>>;
  recordHistory: (debounceKey: string | null) => void;
}

/**
 * Filter CRUD for the currently loaded pagesData. Extracted out of
 * useFlexHeaderSettings since these are pure pagesData transforms with no
 * dependency on the rest of the hook's state.
 */
function useFilterOperations({ pagesData, setPagesData, recordHistory }: UseFilterOperationsParams) {
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
    recordHistory(null);

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
    recordHistory(`filter:${pageId}:${filter.id}`);

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

  return { addFilter, removeFilter, updateFilter };
}

export default useFilterOperations;
