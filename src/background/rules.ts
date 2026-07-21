/**
 * Pure rule-building utilities for the background service worker.
 *
 * Kept separate from background.ts so the logic can be unit tested
 * without loading webextension-polyfill (which only works inside a browser).
 */

import type browser from "webextension-polyfill";
import type { HeaderFilter, HeaderSetting, Page } from "../utils/settings";

export const allResourceTypes: browser.DeclarativeNetRequest.ResourceType[] = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "other",
];

/**
 * Builds the DNR rules for a single enabled header within a page.
 */
export function buildHeaderRules(
  header: HeaderSetting,
  filters: HeaderFilter[],
  getRuleId: () => number
): browser.DeclarativeNetRequest.Rule[] {
  const enabledFilters = filters.filter((filter) => filter.enabled && filter.valid);

  const regexIncludes = enabledFilters
    .filter((filter) => filter.type === "include" && filter.mode === "regex")
    .map((filter) => filter.value);
  const urlIncludes = enabledFilters
    .filter((filter) => filter.type === "include" && filter.mode === "url")
    .map((filter) => filter.value);

  const regexExcludes = enabledFilters
    .filter((filter) => filter.type === "exclude" && filter.mode === "regex")
    .map((filter) => filter.value);
  const urlExcludes = enabledFilters
    .filter((filter) => filter.type === "exclude" && filter.mode === "url")
    .map((filter) => filter.value);

  const hType = header.headerType || "request";
  const modifyHeadersAction: browser.DeclarativeNetRequest.Rule["action"] = {
    type: "modifyHeaders",
    ...(hType === "request"
      ? {
        requestHeaders: [
          {
            header: header.headerName,
            operation: "set",
            value: header.headerValue,
          },
        ],
      }
      : {
        responseHeaders: [
          {
            header: header.headerName,
            operation: "set",
            value: header.headerValue,
          },
        ],
      }),
  };

  const removeHeadersAction: browser.DeclarativeNetRequest.Rule["action"] = {
    type: "modifyHeaders",
    ...(hType === "request"
      ? {
        requestHeaders: [
          {
            header: header.headerName,
            operation: "remove",
          },
        ],
      }
      : {
        responseHeaders: [
          {
            header: header.headerName,
            operation: "remove",
          },
        ],
      }),
  };

  const rules: browser.DeclarativeNetRequest.Rule[] = [];

  regexIncludes.forEach((regexFilter) => {
    rules.push({
      id: getRuleId(),
      priority: 1,
      action: modifyHeadersAction,
      condition: {
        regexFilter,
        resourceTypes: allResourceTypes,
      },
    });
  });

  urlIncludes.forEach((urlFilter) => {
    rules.push({
      id: getRuleId(),
      priority: 1,
      action: modifyHeadersAction,
      condition: {
        urlFilter,
        resourceTypes: allResourceTypes,
      },
    });
  });

  // Default catch-all: only when no include filters are defined
  if (regexIncludes.length === 0 && urlIncludes.length === 0) {
    rules.push({
      id: getRuleId(),
      priority: 1,
      action: modifyHeadersAction,
      condition: {
        regexFilter: "|http*",
        resourceTypes: allResourceTypes,
      },
    });
  }

  if (regexExcludes.length > 0) {
    regexExcludes.forEach((regexFilter) => {
      rules.push({
        id: getRuleId(),
        priority: 2,
        action: removeHeadersAction,
        condition: {
          regexFilter,
          resourceTypes: allResourceTypes,
        },
      });
    });
  }

  urlExcludes.forEach((urlFilter) => {
    rules.push({
      id: getRuleId(),
      priority: 2,
      action: removeHeadersAction,
      condition: {
        urlFilter,
        resourceTypes: allResourceTypes,
      },
    });
  });

  return rules;
}

/**
 * Builds DNR rules for all enabled headers across all pages.
 *
 * This is the pure core of the background service worker's rule update path.
 * It is tested separately so we can verify migration behaviour (e.g. old
 * stored pages whose filters lack a `mode`) without loading
 * webextension-polyfill.
 */
export function buildRulesFromPages(
  pages: Page[],
  getRuleId: () => number
): browser.DeclarativeNetRequest.Rule[] {
  const rules: browser.DeclarativeNetRequest.Rule[] = [];

  pages.forEach((page) => {
    if (page.paused) return;
    if (!page.enabled && !page.keepEnabled) return;

    page.headers.forEach((header) => {
      if (header.headerEnabled && header.headerName) {
        rules.push(...buildHeaderRules(header, page.filters || [], getRuleId));
      }
    });
  });

  return rules;
}
