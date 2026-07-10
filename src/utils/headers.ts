import type { HeaderSetting, Page } from "./settings";

export const normalizeHeader = (header: any): HeaderSetting => ({
  ...header,
  headerComment: header.headerComment ?? "",
  headerType: header.headerType || "request",
});

export const normalizePage = (page: any): Page => ({
  ...page,
  headers: page.headers?.map(normalizeHeader) || [],
});
