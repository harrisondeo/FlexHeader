import { PAGE_KEY_PREFIX, SETTINGS_V3_META_KEY, SETTINGS_KEY, SYNC_INTERVAL, LAST_SYNC_TIME_KEY, SELECTED_PAGE_KEY } from "../constants";
import { Page, PagesData, SettingsV3Meta } from "../utils/settings";
import browser from "webextension-polyfill";
import { getAllFromStorage, saveToStorage, getDataSizeInBytes } from "../utils/storage";
import { log } from "../utils/log";

const allResourceTypes = Object.values(
  chrome.declarativeNetRequest.ResourceType
);

export async function getAndApplyHeaderRules() {
  try {
    // First try to get metadata from the v3 format
    const metaResult = await browser.storage.local.get(SETTINGS_V3_META_KEY);
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
      // Fetch all pages using the distributed storage format
      const pagePromises = [];
      for (let i = 0; i < meta.pageCount; i++) {
        pagePromises.push(browser.storage.local.get(`${PAGE_KEY_PREFIX}${i}`));
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
      const legacyResult = await browser.storage.local.get(SETTINGS_KEY);

      if (legacyResult[SETTINGS_KEY]) {
        pages = (legacyResult[SETTINGS_KEY] as PagesData).pages;
      }
    }

    console.log(
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

/**
 * Syncs data from local storage to sync storage
 * This function will be called periodically to ensure data is synced across devices
 */
export async function syncLocalToRemoteStorage() {
  try {
    log("BACKGROUND: Starting sync from local to remote storage", "info");

    // Get metadata from local storage
    const localData = await getAllFromStorage('local');
    const metaKey = SETTINGS_V3_META_KEY;
    const metadata = localData[metaKey] as SettingsV3Meta | undefined;

    if (!metadata) {
      log("BACKGROUND: No metadata found in local storage, skipping sync", "warning");
      return;
    }

    // Prepare all data that needs to be synced
    const dataToSync: Record<string, any> = {
      [metaKey]: metadata
    };

    // Add all pages
    const pagePromises = [];
    for (let i = 0; i < metadata.pageCount; i++) {
      const pageKey = `${PAGE_KEY_PREFIX}${i}`;
      if (pageKey in localData) {
        const page = localData[pageKey] as Page;
        const sizeInBytes = getDataSizeInBytes(page);
        const STORAGE_LIMIT = 8192; // 8KB for sync storage

        if (sizeInBytes > STORAGE_LIMIT) {
          log(`BACKGROUND: Page ${i} too large for sync storage (${sizeInBytes} bytes > ${STORAGE_LIMIT} bytes)`, "error");
          continue;
        }

        dataToSync[pageKey] = page;
      }
    }

    // Add other settings (like darkMode and selectedPage) that should be synced
    if ("darkMode" in localData) {
      dataToSync["darkMode"] = localData["darkMode"];
    }

    if (SELECTED_PAGE_KEY in localData) {
      dataToSync[SELECTED_PAGE_KEY] = localData[SELECTED_PAGE_KEY];
    }

    // Sync to remote storage
    await browser.storage.sync.set(dataToSync);

    // Update last sync time
    await saveToStorage(LAST_SYNC_TIME_KEY, Date.now(), 'local');

    log("BACKGROUND: Successfully synced local data to remote storage", "success");
  } catch (error) {
    console.error("Failed to sync to remote storage:", error);
    log("BACKGROUND: Failed to sync to remote storage", "error");
  }
}

browser.storage.local.onChanged.addListener(function (changes) {
  // Trigger update if any settings change (v3 meta or any page_* key)
  if (SETTINGS_V3_META_KEY in changes || SETTINGS_KEY in changes ||
    Object.keys(changes).some(key => key.startsWith(PAGE_KEY_PREFIX))) {
    getAndApplyHeaderRules();
  }
});

// Set up periodic sync from local to remote storage
setInterval(syncLocalToRemoteStorage, SYNC_INTERVAL);

// Initial execution of rules and sync
getAndApplyHeaderRules();
syncLocalToRemoteStorage();
