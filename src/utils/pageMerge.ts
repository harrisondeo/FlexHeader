import type { Page } from "./settings";

/**
 * Fallback match for pages with no persisted `pageId` yet (see mergePages).
 * Sorted so ordering doesn't affect the key, and limited to fields that
 * describe meaning rather than incidental id/enabled state.
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
 * Matches pages by `pageId` (newer `lastModified` wins, local `id`/`enabled`
 * always kept) so an edit updates the existing page in place instead of
 * forking a duplicate. Content-key matching is only a one-time fallback for
 * pre-pageId pages - never used once both sides have real ids, so two
 * distinct pages with coincidentally identical content are never collapsed.
 * Unmatched incoming pages are appended disabled; local pages are never
 * removed.
 */
export const mergePages = (localPages: Page[], incomingPages: Page[]): Page[] => {
  const localByPageId = new Map<string, Page>();
  const legacyLocalByContentKey = new Map<string, Page>();
  const allLocalByContentKey = new Map<string, Page>();

  localPages.forEach(page => {
    if (page.pageId) {
      localByPageId.set(page.pageId, page);
    } else {
      legacyLocalByContentKey.set(getPageKey(page), page);
    }
    allLocalByContentKey.set(getPageKey(page), page);
  });

  const resultPages: Page[] = [...localPages];
  const newPages: Page[] = [];
  let changed = false;

  incomingPages.forEach(incomingPage => {
    const matchedLocal = incomingPage.pageId
      ? localByPageId.get(incomingPage.pageId) ?? legacyLocalByContentKey.get(getPageKey(incomingPage))
      : allLocalByContentKey.get(getPageKey(incomingPage));

    if (!matchedLocal) {
      newPages.push(incomingPage);
      return;
    }

    const incomingIsNewer = (incomingPage.lastModified ?? 0) > (matchedLocal.lastModified ?? 0);
    const index = resultPages.indexOf(matchedLocal);

    if (incomingIsNewer) {
      resultPages[index] = {
        ...incomingPage,
        id: matchedLocal.id,
        enabled: matchedLocal.enabled,
      };
      changed = true;
    } else if (!matchedLocal.pageId && incomingPage.pageId) {
      // Adopt the incoming id so future merges match directly, not via
      // the content fallback again.
      resultPages[index] = { ...matchedLocal, pageId: incomingPage.pageId };
      changed = true;
    }
  });

  if (newPages.length === 0 && !changed) {
    return localPages;
  }

  return [
    ...resultPages.map((page, index) => ({
      ...page,
      id: index,
    })),
    ...newPages.map((page, index) => ({
      ...page,
      id: resultPages.length + index,
      enabled: false, // Incoming pages are disabled by default
    })),
  ];
};
