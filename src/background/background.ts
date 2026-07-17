import { PAGE_KEY_PREFIX, SETTINGS_V3_META_KEY, SYNC_INTERVAL, LAST_SYNC_TIME_KEY, SELECTED_PAGE_KEY, SYNC_ENABLED_KEY, ERRORS_STATE_KEY } from "../constants";
import type { Page, SettingsV3Meta } from "../utils/settings";
import browser from "webextension-polyfill";
import { getAllFromStorage, saveToStorage, getDataSizeInBytes, loadFromStorage } from "../utils/storage";
import { log } from "../utils/log";
import { normalizePage } from "../utils/headers";
import { addStoredError, clearStoredErrors } from "../utils/errors";

import { buildRulesFromPages } from "./rules";

export async function getAndApplyHeaderRules() {
  try {
    // First try to get metadata from the v3 format
    const metaResult = await browser.storage.local.get(SETTINGS_V3_META_KEY);
    const meta = metaResult[SETTINGS_V3_META_KEY] as SettingsV3Meta | undefined;

    // Get existing rules
    const oldRules = await browser.declarativeNetRequest.getDynamicRules();
    const oldRuleIds = oldRules ? oldRules.map((rule) => rule.id) : [];

    let nextRuleId = 1;
    const getUniqueRuleID = () => nextRuleId++;

    let pages: Page[] = [];

    if (!meta) {
      console.log("FlexHeader: No settings metadata found, applying empty rules");
    } else {
      // Fetch all pages using the distributed storage format
      const pagePromises = [];
      for (let i = 0; i < meta.pageCount; i++) {
        pagePromises.push(browser.storage.local.get(`${PAGE_KEY_PREFIX}${i}`));
      }

      const pageResults = await Promise.all(pagePromises);
      const loadedPages: Page[] = [];
      for (let i = 0; i < meta.pageCount; i++) {
        const pageKey = `${PAGE_KEY_PREFIX}${i}`;
        const page = pageResults[i][pageKey] as Page | undefined;
        if (!page) {
          throw new Error(`Incomplete local page data: page "${pageKey}" is missing.`);
        }
        loadedPages.push(normalizePage(page));
      }
      pages = loadedPages;
    }

    console.log(
      "%cBACKGROUND: Pages loaded",
      "color: #1976d2; font-weight: bold;"
    );
    const headers = buildRulesFromPages(pages, getUniqueRuleID);

    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldRuleIds,
      addRules: headers,
    });

    // Clear apply errors once rules have been successfully updated
    await clearStoredErrors("apply");
  } catch (error) {
    console.error("Error in getAndApplyHeaderRules", error);
    const message = error instanceof Error ? error.message : "Failed to apply header rules";
    await addStoredError(
      "apply",
      message,
      error instanceof Error ? error.stack : undefined
    );
  }
}

/**
 * Syncs data from local storage to sync storage
 * This function will be called periodically to ensure data is synced across devices
 * Only syncs if sync is enabled in user preferences
 */
export async function syncLocalToRemoteStorage() {
  try {
    // Check if sync is enabled
    const syncEnabled = await loadFromStorage(SYNC_ENABLED_KEY, false, ['local']);
    if (!syncEnabled) {
      log("BACKGROUND: Sync is disabled, skipping sync to remote storage", "info");
      return;
    }

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
    for (let i = 0; i < metadata.pageCount; i++) {
      const pageKey = `${PAGE_KEY_PREFIX}${i}`;
      if (pageKey in localData) {
        const page = normalizePage(localData[pageKey] as Page);
        const sizeInBytes = getDataSizeInBytes(page);
        const STORAGE_LIMIT = 8192; // 8KB for sync storage

        if (sizeInBytes > STORAGE_LIMIT) {
          const errMsg = `Page ${i} ("${page.name}") too large for sync storage (${sizeInBytes} bytes > ${STORAGE_LIMIT} bytes). Aborting sync to prevent remote data corruption.`;
          log(`BACKGROUND: ${errMsg}`, "error");
          throw new Error(errMsg);
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
    const message = error instanceof Error ? error.message : "Failed to sync settings to remote storage";
    await addStoredError(
      "sync",
      message,
      error instanceof Error ? error.stack : undefined
    );
  }
}

/**
 * Merges local and sync pages with timestamp conflict resolution
 */
function mergePages(localPages: Page[], syncPages: Page[]): Page[] {
  const localPagesMap = new Map<string, Page>();
  localPages.forEach(page => {
    localPagesMap.set(page.name, page);
  });

  const mergedPagesList = [...localPages];

  syncPages.forEach((syncPage) => {
    const localPage = localPagesMap.get(syncPage.name);
    if (!localPage) {
      mergedPagesList.push({
        ...syncPage,
        enabled: false, // Default remote sync pages to disabled
      });
    } else {
      const localTime = localPage.lastModified ?? 0;
      const syncTime = syncPage.lastModified ?? 0;

      if (syncTime > localTime) {
        log(`BACKGROUND: Merging remote sync updates for page "${syncPage.name}" (remote is newer: ${syncTime} > ${localTime})`, "info");
        const index = mergedPagesList.findIndex(p => p.name === syncPage.name);
        if (index !== -1) {
          mergedPagesList[index] = {
            ...syncPage,
            enabled: localPage.enabled, // Preserve local enabled state (device-specific)
          };
        }
      }
    }
  });

  return mergedPagesList.map((page, index) => ({
    ...page,
    id: index,
  }));
}

/**
 * Syncs pages from remote sync storage to local storage
 */
export async function syncRemoteToLocalStorage() {
  try {
    const syncEnabled = await loadFromStorage(SYNC_ENABLED_KEY, false, ['local']);
    if (!syncEnabled) {
      log("BACKGROUND: Sync is disabled, skipping remote pull", "info");
      return;
    }

    log("BACKGROUND: Starting remote-to-local sync pull", "info");

    // Load local pages
    const localMetaResult = await browser.storage.local.get(SETTINGS_V3_META_KEY);
    const localMeta = localMetaResult[SETTINGS_V3_META_KEY] as SettingsV3Meta | undefined;
    let localPages: Page[] = [];

    if (localMeta) {
      const pagePromises = [];
      for (let i = 0; i < localMeta.pageCount; i++) {
        pagePromises.push(browser.storage.local.get(`${PAGE_KEY_PREFIX}${i}`));
      }
      const pageResults = await Promise.all(pagePromises);
      for (let i = 0; i < localMeta.pageCount; i++) {
        const pageKey = `${PAGE_KEY_PREFIX}${i}`;
        const page = pageResults[i][pageKey] as Page | undefined;
        if (page) {
          localPages.push(normalizePage(page));
        }
      }
    }

    // Load remote/sync pages
    const syncMetaResult = await browser.storage.sync.get(SETTINGS_V3_META_KEY);
    const syncMeta = syncMetaResult[SETTINGS_V3_META_KEY] as SettingsV3Meta | undefined;

    if (!syncMeta) {
      log("BACKGROUND: No remote sync metadata found, nothing to pull", "warning");
      return;
    }

    const pagePromises = [];
    for (let i = 0; i < syncMeta.pageCount; i++) {
      pagePromises.push(browser.storage.sync.get(`${PAGE_KEY_PREFIX}${i}`));
    }
    const pageResults = await Promise.all(pagePromises);
    const syncPages: Page[] = [];
    for (let i = 0; i < syncMeta.pageCount; i++) {
      const pageKey = `${PAGE_KEY_PREFIX}${i}`;
      const page = pageResults[i][pageKey] as Page | undefined;
      if (page) {
        syncPages.push(normalizePage(page));
      }
    }

    if (syncPages.length === 0) {
      return;
    }

    // Merge pages
    const mergedPages = mergePages(localPages, syncPages);

    // If there is any difference, save to local storage
    if (JSON.stringify(mergedPages) !== JSON.stringify(localPages)) {
      log("BACKGROUND: Remote sync pages have updates! Saving to local storage.", "info");

      // Save metadata first
      const newMeta: SettingsV3Meta = {
        version: 3,
        selectedPage: localMeta ? localMeta.selectedPage : 0,
        pageCount: mergedPages.length
      };

      // Write metadata and all pages to local storage in a single operation
      const dataToSave: Record<string, any> = {
        [SETTINGS_V3_META_KEY]: newMeta
      };

      mergedPages.forEach((page, index) => {
        dataToSave[`${PAGE_KEY_PREFIX}${index}`] = page;
      });

      // If page count decreased, clean up orphaned local keys
      if (localMeta && localMeta.pageCount > mergedPages.length) {
        const keysToRemove = [];
        for (let i = mergedPages.length; i < localMeta.pageCount; i++) {
          keysToRemove.push(`${PAGE_KEY_PREFIX}${i}`);
        }
        await browser.storage.local.remove(keysToRemove);
      }

      await browser.storage.local.set(dataToSave);
      log("BACKGROUND: Successfully updated local storage with merged remote pages.", "success");
    } else {
      log("BACKGROUND: Local and remote sync pages are already in sync.", "info");
    }
  } catch (error) {
    console.error("BACKGROUND: Failed to sync remote to local storage:", error);
    const message = error instanceof Error ? error.message : "Failed to sync remote settings to local storage";
    await addStoredError(
      "sync",
      message,
      error instanceof Error ? error.stack : undefined
    );
  }
}

/**
 * Wires up the background service worker's listeners and kicks off the
 * initial rule application + sync. Called from the WXT background
 * entrypoint (src/entrypoints/background.ts) so that none of this runs
 * during the Node-based build step.
 */
export function initBackground() {
  browser.storage.onChanged.addListener(async function (changes, areaName) {
    if (areaName === 'local') {
      // Trigger update if any settings change (v3 meta or any page_* key)
      if (SETTINGS_V3_META_KEY in changes ||
        Object.keys(changes).some(key => key.startsWith(PAGE_KEY_PREFIX))) {
        getAndApplyHeaderRules();
      }
    } else if (areaName === 'sync') {
      log("BACKGROUND: Remote sync changes detected, merging...", "info");
      await syncRemoteToLocalStorage();
    }
  });

  // Set up periodic sync from local to remote storage
  setInterval(syncLocalToRemoteStorage, SYNC_INTERVAL);

  // Initial execution of rules and sync
  getAndApplyHeaderRules();
  syncRemoteToLocalStorage();
  syncLocalToRemoteStorage();
}
