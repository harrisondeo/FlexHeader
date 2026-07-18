import type { Page } from "./settings";
import { TOMBSTONE_RETENTION_MS } from "../constants";

export interface PageTombstone {
  pageId: string;
  deletedAt: number;
}

export interface SyncState {
  pages: Page[];
  tombstones: PageTombstone[];
}

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

/**
 * A page's absence can't be trusted by an additive merge - it's
 * indistinguishable from "not synced yet". A tombstone gives deletion the
 * same timestamped signal an edit already gets from `lastModified`, so
 * mergeSyncState can resolve edit-vs-delete the same way it resolves
 * edit-vs-edit: newest timestamp wins.
 */
export const createTombstone = (page: Page): PageTombstone | null =>
  page.pageId ? { pageId: page.pageId, deletedAt: Date.now() } : null;

/**
 * Copies a page under a brand-new identity. Used when a page must be
 * recreated (e.g. the last page was deleted) - reusing the template's own
 * pageId/lastModified would let the tombstone that was just created for it
 * immediately re-exclude the recreated copy on the next merge.
 */
export const synthesizeFallbackPage = (template: Page): Page => ({
  ...template,
  id: 0,
  pageId: crypto.randomUUID(),
  enabled: true,
  lastModified: Date.now(),
});

export const pruneExpiredTombstones = (
  tombstones: PageTombstone[],
  now: number = Date.now(),
  retentionMs: number = TOMBSTONE_RETENTION_MS
): PageTombstone[] => {
  const pruned = tombstones.filter((t) => now - t.deletedAt <= retentionMs);
  return pruned.length === tombstones.length ? tombstones : pruned;
};

/** Unions two tombstone lists, keeping the newest `deletedAt` per pageId. */
export const mergeTombstones = (
  localTombstones: PageTombstone[],
  incomingTombstones: PageTombstone[]
): PageTombstone[] => {
  const byPageId = new Map<string, PageTombstone>();
  localTombstones.forEach((t) => byPageId.set(t.pageId, t));

  let changed = false;
  incomingTombstones.forEach((t) => {
    const existing = byPageId.get(t.pageId);
    if (!existing || t.deletedAt > existing.deletedAt) {
      byPageId.set(t.pageId, t);
      changed = true;
    }
  });

  return changed ? Array.from(byPageId.values()) : localTombstones;
};

/**
 * Excludes any page whose tombstone is newer than the page's own
 * `lastModified` - strictly newer, so a tie doesn't resurrect a page and an
 * edit made after the delete (lastModified > deletedAt) keeps it alive.
 */
export const applyTombstones = (pages: Page[], tombstones: PageTombstone[]): Page[] => {
  if (tombstones.length === 0) return pages;

  const deletedAtByPageId = new Map(tombstones.map((t) => [t.pageId, t.deletedAt]));
  const surviving = pages.filter((page) => {
    if (!page.pageId) return true;
    const deletedAt = deletedAtByPageId.get(page.pageId);
    return deletedAt === undefined || deletedAt <= (page.lastModified ?? 0);
  });

  return surviving.length === pages.length ? pages : surviving;
};

/**
 * The single entry point every "combine a local view with a remote view"
 * call site should use (background's continuous sync, and settings.ts's
 * enable-sync / bootstrap-from-sync paths) so tombstone handling can never
 * be bypassed. Tombstones are unioned and applied to *both* sides before the
 * survivors go through the existing pageId/content-key/last-write-wins
 * mergePages, so a page tombstoned on one device is also dropped from a
 * third device that independently still holds it.
 *
 * Never returns an empty page list - a merge can legitimately tombstone
 * every page a device has (e.g. two untouched installs share the pristine
 * default page's fixed pageId, and one of them deletes it), and background.ts
 * has no popup open to run the UI's own empty-pages safety net.
 * `fallbackTemplate` supplies the content (e.g. the built-in Default page) to
 * recreate in that case, under a fresh identity via synthesizeFallbackPage.
 *
 * Returns the same `pages`/`tombstones` references as `local` when nothing
 * changed, so callers can keep using cheap `!==` no-op checks.
 */
export const mergeSyncState = (
  local: SyncState,
  incoming: SyncState,
  fallbackTemplate: Page
): SyncState => {
  const mergedTombstones = pruneExpiredTombstones(mergeTombstones(local.tombstones, incoming.tombstones));

  const survivingLocalPages = applyTombstones(local.pages, mergedTombstones);
  const survivingIncomingPages = applyTombstones(incoming.pages, mergedTombstones);

  const mergedPages = mergePages(survivingLocalPages, survivingIncomingPages);
  const finalPages = mergedPages.length > 0 ? mergedPages : [synthesizeFallbackPage(fallbackTemplate)];

  return {
    pages: finalPages,
    tombstones: mergedTombstones,
  };
};
