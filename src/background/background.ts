import { SETTINGS_KEY } from "../constants";
import { Page, PagesData } from "../utils/settings";
import browser from "webextension-polyfill";

console.log("FlexHeader: background.js");

const allResourceTypes = Object.values(
  chrome.declarativeNetRequest.ResourceType
);

export function getAndApplyHeaderRules() {
  browser.storage.sync
    .get(SETTINGS_KEY)
    .then(async (result) => {
      let headers: browser.DeclarativeNetRequest.Rule[] = [];

      const oldRules = await browser.declarativeNetRequest.getDynamicRules();
      const oldRuleIds = oldRules ? oldRules.map((rule) => rule.id) : [];

      function getUniqueRuleID() {
        let id = Math.floor(Math.random() * 1000000000);
        while (oldRuleIds.includes(id)) {
          id = Math.floor(Math.random() * 1000000000);
        }
        return id;
      }

      if (result[SETTINGS_KEY]) {
        ((result[SETTINGS_KEY] as PagesData).pages as Page[]).forEach(
          (page: Page) => {
            if (page.enabled || page.keepEnabled) {
              // each setting
              page.headers.forEach((header: any) => {
                if (header.headerEnabled && header.headerName) {
                  // Check for filters
                  let regexFilter = "";

                  if (page.filters) {
                    page.filters.forEach((filter) => {
                      if (filter.enabled && filter.valid) {
                        if (filter.type === "include") {
                          if (regexFilter === "") {
                            regexFilter += filter.value;
                          } else {
                            regexFilter += `|${filter.value}`;
                          }
                        } else {
                          if (regexFilter === "") {
                            regexFilter += `~${filter.value}`;
                          } else {
                            regexFilter += `|~${filter.value}`;
                          }
                        }
                      }
                    });
                  }

                  // Ready to push
                  const hType = header.headerType || "request";
                  headers.push({
                    id: getUniqueRuleID(),
                    priority: 1,
                    action: {
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
                    },
                    condition: {
                      regexFilter: regexFilter || "|http*",
                      resourceTypes: allResourceTypes,
                    },
                  });
                }
              });
            }
          }
        );
      }

      browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldRuleIds,
        addRules: headers,
      });
    })
    .catch((error) => {
      console.error("Error in getAndApplyHeaderRules", error);
    });
}

browser.storage.onChanged.addListener(function (changes) {
  if (SETTINGS_KEY in changes) {
    getAndApplyHeaderRules();
  }
});

getAndApplyHeaderRules();
