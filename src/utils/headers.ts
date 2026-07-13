import type { HeaderFilter, HeaderSetting, Page } from "./settings";

export const normalizeHeader = (header: any): HeaderSetting => ({
  ...header,
  headerComment: header.headerComment ?? "",
  headerType: header.headerType || "request",
});

export const normalizeFilter = (filter: any): HeaderFilter => ({
  ...filter,
  mode: filter.mode ?? "regex",
});

export const normalizePage = (page: any): Page => ({
  ...page,
  showHeaderComments: page.showHeaderComments ?? true,
  headers: page.headers?.map(normalizeHeader) || [],
  filters: page.filters?.map(normalizeFilter) || [],
});
