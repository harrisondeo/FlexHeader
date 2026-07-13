import type { HeaderFilter, HeaderSetting, Page } from "./settings";

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
 */
export const normalizePage = (page: any): Page => ({
  ...page,
  showHeaderComments: page.showHeaderComments ?? true,
  headers: page.headers?.map(normalizeHeader) || [],
  filters: page.filters?.map(normalizeFilter) || [],
});
