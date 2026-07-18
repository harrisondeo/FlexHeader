import { PAGE_KEY_PREFIX, SETTINGS_V3_META_KEY, SYNC_INTERVAL, LAST_SYNC_TIME_KEY, SELECTED_PAGE_KEY, SYNC_ENABLED_KEY, ERRORS_STATE_KEY } from "../constants";
import type { Page, SettingsV3Meta } from "../utils/settings";
import browser from "webextension-polyfill";
import { getAllFromStorage, saveToStorage, getDataSizeInBytes, loadFromStorage } from "../utils/storage";
import { log } from "../utils/log";
import { normalizePage } from "../utils/headers";
import { mergePages } from "../utils/pageMerge";
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
      pages = pageResults
        .map((result, index) => {
          const pageKey = `${PAGE_KEY_PREFIX}${index}`;
          return result[pageKey] as Page;
        })
        .filter(Boolean) // Filter out any undefined/null pages
        .map(normalizePage);
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
    const message = error instanceof Error ? error.message : "Failed to sync settings to remote storage";
    await addStoredError(
      "sync",
      message,
      error instanceof Error ? error.stack : undefined
    );
  }
}

/**
 * Reads the full v3-format settings (meta + pages) out of a given storage area.
 */
async function readV3Settings(area: browser.Storage.StorageArea): Promise<{ meta: SettingsV3Meta; pages: Page[] } | null> {
  const metaResult = await area.get(SETTINGS_V3_META_KEY);
  const meta = metaResult[SETTINGS_V3_META_KEY] as SettingsV3Meta | undefined;

  if (!meta) {
    return null;
  }

  const pagePromises = [];
  for (let i = 0; i < meta.pageCount; i++) {
    pagePromises.push(area.get(`${PAGE_KEY_PREFIX}${i}`));
  }

  const pageResults = await Promise.all(pagePromises);
  const pages = pageResults
    .map((result, index) => result[`${PAGE_KEY_PREFIX}${index}`] as Page)
    .filter(Boolean)
    .map(normalizePage);

  return { meta, pages };
}

/**
 * Writes a full set of pages to local storage as v3-format settings, keeping
 * the current selected page. Also removes any now-stale page_* keys beyond
 * the new page count.
 */
async function writePagesToLocalStorage(pages: Page[], selectedPage: number): Promise<void> {
  const existingLocal = await getAllFromStorage('local');

  const metadata: SettingsV3Meta = {
    version: 3,
    selectedPage,
    pageCount: pages.length,
  };

  const dataToWrite: Record<string, unknown> = {
    [SETTINGS_V3_META_KEY]: metadata,
    localModifiedTime: Date.now(),
  };
  pages.forEach((page, index) => {
    dataToWrite[`${PAGE_KEY_PREFIX}${index}`] = page;
  });

  await browser.storage.local.set(dataToWrite);

  // Clean up any now-stale page keys left over from a smaller page count
  const stalePageKeys = Object.keys(existingLocal)
    .filter(key => key.startsWith(PAGE_KEY_PREFIX))
    .filter(key => parseInt(key.replace(PAGE_KEY_PREFIX, '')) >= pages.length);

  if (stalePageKeys.length > 0) {
    await browser.storage.local.remove(stalePageKeys);
  }
}

/**
 * Pulls data from sync storage into local storage.
 * This runs periodically and whenever sync storage changes (e.g. another
 * synced browser pushed an update), so pages/headers added elsewhere show up
 * without requiring the extension to be reloaded.
 *
 * Merging is strictly additive: existing local pages are never removed or
 * overwritten by this function, only pages that don't already exist locally
 * are appended (disabled), so a sync pull can never lose local data.
 */
export async function syncRemoteToLocalStorage() {
  try {
    const syncEnabled = await loadFromStorage(SYNC_ENABLED_KEY, false, ['local']);
    if (!syncEnabled) {
      log("BACKGROUND: Sync is disabled, skipping pull from remote storage", "info");
      return;
    }

    log("BACKGROUND: Checking remote storage for updates", "info");

    const syncSettings = await readV3Settings(browser.storage.sync);
    if (!syncSettings || syncSettings.pages.length === 0) {
      // Nothing in sync storage yet to pull down
      return;
    }

    const localSettings = await readV3Settings(browser.storage.local);

    if (!localSettings || localSettings.pages.length === 0) {
      // No local data at all - bootstrap straight from sync
      log("BACKGROUND: No local data found, bootstrapping from remote storage", "info");
      await writePagesToLocalStorage(syncSettings.pages, syncSettings.meta.selectedPage);
      return;
    }

    const mergedPages = mergePages(localSettings.pages, syncSettings.pages);

    if (mergedPages.length > localSettings.pages.length) {
      log(`BACKGROUND: Merging ${mergedPages.length - localSettings.pages.length} page(s) from remote storage`, "success");
      await writePagesToLocalStorage(mergedPages, localSettings.meta.selectedPage);
    }
  } catch (error) {
    console.error("Failed to sync from remote storage:", error);
    log("BACKGROUND: Failed to sync from remote storage", "error");
    const message = error instanceof Error ? error.message : "Failed to sync settings from remote storage";
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
  browser.storage.local.onChanged.addListener(function (changes) {
    // Trigger update if any settings change (v3 meta or any page_* key)
    if (SETTINGS_V3_META_KEY in changes ||
      Object.keys(changes).some(key => key.startsWith(PAGE_KEY_PREFIX))) {
      getAndApplyHeaderRules();
    }
  });

  // Pull immediately whenever sync storage changes - e.g. Chrome/Firefox
  // propagating an update pushed by another signed-in browser - rather than
  // waiting for this browser to reload or the periodic interval to fire.
  browser.storage.sync.onChanged.addListener(function () {
    syncRemoteToLocalStorage();
  });

  // Periodically pull from remote storage, then push local state back up so
  // any newly-merged pages are reflected in sync storage too.
  setInterval(function () {
    syncRemoteToLocalStorage().finally(syncLocalToRemoteStorage);
  }, SYNC_INTERVAL);

  // Initial execution: pull down any remote updates first so we don't push a
  // smaller/stale local page set over what's already in sync storage, then
  // apply rules and push local state back up.
  syncRemoteToLocalStorage().finally(() => {
    getAndApplyHeaderRules();
    syncLocalToRemoteStorage();
  });
}
