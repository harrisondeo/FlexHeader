import { Page } from "../utils/settings";

console.log("FlexHeader: background.js");

const allResourceTypes = Object.values(
  chrome.declarativeNetRequest.ResourceType
);

export function getAndApplyHeaderRules() {
  chrome.storage.sync.get("settings", async (result) => {
    let headers: chrome.declarativeNetRequest.Rule[] = [];

    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldRuleIds = oldRules ? oldRules.map((rule) => rule.id) : [];

    function getUniqueRuleID() {
      let id = Math.floor(Math.random() * 1000000000);
      while (oldRuleIds.includes(id)) {
        id = Math.floor(Math.random() * 1000000000);
      }
      return id;
    }

    if (result.settings as Page[]) {
      result.settings.forEach((page: Page) => {
        if (page.enabled) {
          // each setting
          page.headers.forEach((header, i) => {
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
              headers.push({
                id: getUniqueRuleID(),
                priority: 1,
                action: {
                  type: chrome.declarativeNetRequest.RuleActionType
                    .MODIFY_HEADERS,
                  requestHeaders: [
                    {
                      header: header.headerName,
                      operation:
                        chrome.declarativeNetRequest.HeaderOperation.SET,
                      value: header.headerValue,
                    },
                  ],
                },
                condition: {
                  regexFilter: regexFilter || "|http*",
                  resourceTypes: allResourceTypes,
                },
              });
            }
          });
        }
      });
    }

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldRuleIds,
      addRules: headers,
    });
  });
}

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if ("settings" in changes) {
    getAndApplyHeaderRules();
  }
});

getAndApplyHeaderRules();
