import type { Page } from "./settings";

/**
 * Creates a unique key for a page based on its name, headers, and filters.
 * Used for deduplication when merging pages from another storage source.
 * Sorted so that header/filter ordering doesn't affect the key, and limited
 * to the fields that describe a header/filter's meaning (not its id or
 * enabled state) so the same page created independently on two browsers -
 * where ids are assigned per-position and won't match - is still recognized
 * as a duplicate instead of merging in as a redundant copy.
 */
export const getPageKey = (page: Page): string => {
  const sortedHeaders = [...page.headers].sort((a, b) => {
    if (a.headerName !== b.headerName) return a.headerName.localeCompare(b.headerName);
    if (a.headerValue !== b.headerValue) return a.headerValue.localeCompare(b.headerValue);
    return 0;
  });
  const sortedFilters = [...page.filters].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.mode !== b.mode) return a.mode.localeCompare(b.mode);
    if (a.value !== b.value) return String(a.value).localeCompare(String(b.value));
    return 0;
  });
  return `${page.name}_${JSON.stringify({
    headers: sortedHeaders.map(h => ({ headerName: h.headerName, headerValue: h.headerValue })),
    filters: sortedFilters.map(f => ({ type: f.type, mode: f.mode, value: f.value })),
  })}`;
};

/**
 * Merges pages from another storage source (e.g. sync storage) into a set of
 * local pages, without ever dropping an existing local page. Only pages that
 * don't already exist locally (by name/headers/filters) are appended, always
 * disabled, so incoming data can never silently take over the active page.
 * @param localPages The current local pages
 * @param incomingPages The pages to merge in (e.g. from sync storage)
 * @returns The merged pages array
 */
export const mergePages = (localPages: Page[], incomingPages: Page[]): Page[] => {
  const localPagesMap = new Map<string, Page>();
  localPages.forEach(page => {
    localPagesMap.set(getPageKey(page), page);
  });

  const newPages: Page[] = [];
  incomingPages.forEach(incomingPage => {
    if (!localPagesMap.has(getPageKey(incomingPage))) {
      newPages.push(incomingPage);
    }
  });

  if (newPages.length === 0) {
    return localPages;
  }

  return [
    ...localPages.map((page, index) => ({
      ...page,
      id: index,
    })),
    ...newPages.map((page, index) => ({
      ...page,
      id: localPages.length + index,
      enabled: false, // Incoming pages are disabled by default
    })),
  ];
};
