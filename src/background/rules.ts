/**
 * Pure rule-building utilities for the background service worker.
 *
 * Kept separate from background.ts so the logic can be unit tested
 * without loading webextension-polyfill (which only works inside a browser).
 */

import type browser from "webextension-polyfill";
import { HeaderFilter, HeaderSetting } from "../utils/settings";

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
  "webtransport",
  "webbundle",
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
  let regexFilter = "";
  let excludeFilter = "";

  filters.forEach((filter) => {
    if (filter.enabled && filter.valid) {
      if (filter.type === "include") {
        regexFilter = regexFilter === "" ? filter.value : `${regexFilter}|${filter.value}`;
      } else {
        excludeFilter = excludeFilter === "" ? filter.value : `${excludeFilter}|${filter.value}`;
      }
    }
  });

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

  const filterCondition: browser.DeclarativeNetRequest.Rule["condition"] = regexFilter
    ? { regexFilter, resourceTypes: allResourceTypes }
    : { regexFilter: "|http*", resourceTypes: allResourceTypes };

  const rules: browser.DeclarativeNetRequest.Rule[] = [
    {
      id: getRuleId(),
      priority: 1,
      action: modifyHeadersAction,
      condition: filterCondition,
    },
  ];

  if (excludeFilter) {
    rules.push({
      id: getRuleId(),
      priority: 2,
      action: {
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
      },
      condition: {
        regexFilter: excludeFilter,
        resourceTypes: allResourceTypes,
      },
    });
  }

  return rules;
}
