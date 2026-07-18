import type { HeaderFilter, HeaderSetting, Page } from "./schemas";

/**
 * Normalizes a header parsed from legacy storage or an imported file so that it
 * matches the current schema. These defaults mirror the Zod schemas in
 * settings.ts and ensure older saved settings load safely.
 */
export const normalizeHeader = (header: any): HeaderSetting => ({
  ...header,
  headerComment: header.headerComment ?? "",
  headerType: header.headerType || "request",
});

/**
 * Normalizes a filter parsed from legacy storage or an imported file so that it
 * matches the current schema.
 */
export const normalizeFilter = (filter: any): HeaderFilter => ({
  ...filter,
  mode: filter.mode ?? "regex",
});

/**
 * Normalizes a page parsed from legacy storage or an imported file so that it
 * matches the current schema.
 *
 * Deliberately does NOT fabricate a `pageId`: this runs on every storage
 * read, including background.ts's non-persisting pulls, so a random id here
 * would be a different throwaway value each call instead of a stable
 * identity. Real ids are backfilled once, in settings.ts's retrieveSettings.
 */
export const normalizePage = (page: any): Page => ({
  ...page,
  lastModified: page.lastModified ?? 0,
  showHeaderComments: page.showHeaderComments ?? true,
  filtersExpanded: page.filtersExpanded ?? true,
  headers: page.headers?.map(normalizeHeader) || [],
  filters: page.filters?.map(normalizeFilter) || [],
});
