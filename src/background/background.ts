import { PAGE_KEY_PREFIX, SETTINGS_V3_META_KEY, SETTINGS_KEY } from "../constants";
import { Page, PagesData, SettingsV3Meta } from "../utils/settings";
import browser from "webextension-polyfill";

const allResourceTypes = Object.values(
  chrome.declarativeNetRequest.ResourceType
);

export async function getAndApplyHeaderRules() {
  try {
    // First try to get metadata from the v3 format
    const metaResult = await browser.storage.sync.get(SETTINGS_V3_META_KEY);
    const meta = metaResult[SETTINGS_V3_META_KEY] as SettingsV3Meta | undefined;

    // Initialize headers array and get existing rules
    let headers: browser.DeclarativeNetRequest.Rule[] = [];
    const oldRules = await browser.declarativeNetRequest.getDynamicRules();
    const oldRuleIds = oldRules ? oldRules.map((rule) => rule.id) : [];

    // Generate unique rule ID
    const getUniqueRuleID = () => {
      let id = Math.floor(Math.random() * 1000000000);
      while (oldRuleIds.includes(id)) {
        id = Math.floor(Math.random() * 1000000000);
      }
      return id;
    };

    let pages: Page[] = [];

    if (meta) {
      // Use v3 storage format
      console.info(
        "%cBACKGROUND: Using V3 storage format",
        "color: #1976d2; font-weight: bold;"
      );

      // Fetch all pages using the distributed storage format
      const pagePromises = [];
      for (let i = 0; i < meta.pageCount; i++) {
        pagePromises.push(browser.storage.sync.get(`${PAGE_KEY_PREFIX}${i}`));
      }

      const pageResults = await Promise.all(pagePromises);
      pages = pageResults
        .map((result, index) => {
          const pageKey = `${PAGE_KEY_PREFIX}${index}`;
          return result[pageKey] as Page;
        })
        .filter(Boolean); // Filter out any undefined/null pages
    } else {
      // Try legacy v2 format as fallback
      console.log("FlexHeader: Falling back to V2 storage format");
      const legacyResult = await browser.storage.sync.get(SETTINGS_KEY);

      if (legacyResult[SETTINGS_KEY]) {
        pages = (legacyResult[SETTINGS_KEY] as PagesData).pages;
      }
    }

    console.info(
      "%cBACKGROUND: Pages loaded",
      "color: #1976d2; font-weight: bold;"
    );
    pages.forEach((page: Page) => {
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
    })

    browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldRuleIds,
      addRules: headers,
    })
  } catch (error) {
    console.error("Error in getAndApplyHeaderRules", error);
  }
}

browser.storage.onChanged.addListener(function (changes) {
  // Trigger update if any settings change (v3 meta or any page_* key)
  if (SETTINGS_V3_META_KEY in changes || SETTINGS_KEY in changes ||
    Object.keys(changes).some(key => key.startsWith(PAGE_KEY_PREFIX))) {
    getAndApplyHeaderRules();
  }
});

getAndApplyHeaderRules();
