import { PAGE_KEY_PREFIX, SETTINGS_V3_META_KEY, PAGE_TOMBSTONES_KEY, SYNC_INTERVAL, LAST_SYNC_TIME_KEY, LAST_MERGE_TIME_KEY, SELECTED_PAGE_KEY, SYNC_ENABLED_KEY, ERRORS_STATE_KEY } from "../constants";
import type { Page, SettingsV3Meta } from "../utils/settings";
import { defaultPage } from "../utils/settings";
import browser from "webextension-polyfill";
import { getAllFromStorage, saveToStorage, getDataSizeInBytes, loadFromStorage } from "../utils/storage";
import { log } from "../utils/log";
import { normalizePage } from "../utils/headers";
import { mergeSyncState, applyTombstones, synthesizeFallbackPage, pruneExpiredTombstones, type PageTombstone } from "../utils/pageMerge";
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

const TOMBSTONES_SYNC_LIMIT = 8192; // 8KB for sync storage

/**
 * Drops the oldest tombstones (least likely to still be needed by a device
 * that hasn't synced in a while) until the list fits sync storage's per-item
 * limit, so a burst of deletions can't silently break the entire sync push.
 */
function fitTombstonesToSyncLimit(tombstones: PageTombstone[]): PageTombstone[] {
  if (getDataSizeInBytes(tombstones) <= TOMBSTONES_SYNC_LIMIT) {
    return tombstones;
  }

  const newestFirst = [...tombstones].sort((a, b) => b.deletedAt - a.deletedAt);
  while (newestFirst.length > 0 && getDataSizeInBytes(newestFirst) > TOMBSTONES_SYNC_LIMIT) {
    newestFirst.pop();
  }

  log(`BACKGROUND: Tombstones exceeded sync storage limit, dropped ${tombstones.length - newestFirst.length} oldest`, "error");
  return newestFirst;
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

    const tombstones = pruneExpiredTombstones((localData[PAGE_TOMBSTONES_KEY] as PageTombstone[] | undefined) ?? []);
    dataToSync[PAGE_TOMBSTONES_KEY] = fitTombstonesToSyncLimit(tombstones);

    // Sync to remote storage
    await browser.storage.sync.set(dataToSync);

    // Remove stale page_N keys left behind in sync storage when the local
    // page count shrinks (e.g. a deleted page) - otherwise a future
    // bootstrap-from-sync could read a page count smaller than the leftover
    // keys and pick one back up.
    try {
      const existingSync = await getAllFromStorage('sync');
      const staleSyncKeys = Object.keys(existingSync)
        .filter(key => key.startsWith(PAGE_KEY_PREFIX))
        .filter(key => parseInt(key.replace(PAGE_KEY_PREFIX, '')) >= metadata.pageCount);

      if (staleSyncKeys.length > 0) {
        await browser.storage.sync.remove(staleSyncKeys);
      }
    } catch (cleanupError) {
      log(`BACKGROUND: Error cleaning up stale sync page keys: ${cleanupError}`, "error");
    }

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

async function readV3Settings(area: browser.Storage.StorageArea): Promise<{ meta: SettingsV3Meta; pages: Page[]; tombstones: PageTombstone[] } | null> {
  const metaResult = await area.get(SETTINGS_V3_META_KEY);
  const meta = metaResult[SETTINGS_V3_META_KEY] as SettingsV3Meta | undefined;

  if (!meta) {
    return null;
  }

  const pagePromises = [];
  for (let i = 0; i < meta.pageCount; i++) {
    pagePromises.push(area.get(`${PAGE_KEY_PREFIX}${i}`));
  }

  const [pageResults, tombstonesResult] = await Promise.all([
    Promise.all(pagePromises),
    area.get(PAGE_TOMBSTONES_KEY),
  ]);
  const pages = pageResults
    .map((result, index) => result[`${PAGE_KEY_PREFIX}${index}`] as Page)
    .filter(Boolean)
    .map(normalizePage);
  const tombstones = (tombstonesResult[PAGE_TOMBSTONES_KEY] as PageTombstone[] | undefined) ?? [];

  return { meta, pages, tombstones };
}

async function writePagesToLocalStorage(pages: Page[], selectedPage: number, tombstones: PageTombstone[]): Promise<void> {
  const existingLocal = await getAllFromStorage('local');

  const metadata: SettingsV3Meta = {
    version: 3,
    selectedPage,
    pageCount: pages.length,
  };

  const dataToWrite: Record<string, unknown> = {
    [SETTINGS_V3_META_KEY]: metadata,
    [PAGE_TOMBSTONES_KEY]: pruneExpiredTombstones(tombstones),
    localModifiedTime: Date.now(),
    [LAST_MERGE_TIME_KEY]: Date.now(),
  };
  pages.forEach((page, index) => {
    dataToWrite[`${PAGE_KEY_PREFIX}${index}`] = page;
  });

  await browser.storage.local.set(dataToWrite);

  // Guards against leftover page_N keys if this is ever called with fewer
  // pages than are currently stored - stale keys would otherwise linger.
  const stalePageKeys = Object.keys(existingLocal)
    .filter(key => key.startsWith(PAGE_KEY_PREFIX))
    .filter(key => parseInt(key.replace(PAGE_KEY_PREFIX, '')) >= pages.length);

  if (stalePageKeys.length > 0) {
    await browser.storage.local.remove(stalePageKeys);
  }
}

/**
 * Runs on an interval and on storage.sync.onChanged so pages/edits/deletes
 * from another browser show up without a reload. mergeSyncState guarantees
 * this can never silently drop a page that hasn't also been tombstoned.
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
    if (!syncSettings) {
      return;
    }
    if (syncSettings.pages.length === 0 && syncSettings.tombstones.length === 0) {
      // Truly nothing in sync storage yet - a pages-only check here would
      // also skip tombstone-only remote state (e.g. every page was deleted).
      return;
    }

    const localSettings = await readV3Settings(browser.storage.local);

    if (!localSettings || localSettings.pages.length === 0) {
      // No local pages to protect - adopt remote directly rather than
      // through mergeSyncState/mergePages, which would mark every page
      // disabled (correct when merging alongside an existing local
      // selection, wrong when there isn't one yet).
      log("BACKGROUND: No local data found, bootstrapping from remote storage", "info");
      const bootstrapPages = applyTombstones(syncSettings.pages, syncSettings.tombstones);
      const finalPages = bootstrapPages.length > 0 ? bootstrapPages : [synthesizeFallbackPage(defaultPage)];
      await writePagesToLocalStorage(finalPages, syncSettings.meta.selectedPage, syncSettings.tombstones);
      return;
    }

    const merged = mergeSyncState(
      { pages: localSettings.pages, tombstones: localSettings.tombstones },
      { pages: syncSettings.pages, tombstones: syncSettings.tombstones },
      defaultPage
    );

    // mergeSyncState returns the exact same references when nothing needed
    // to change, so this also catches in-place edits and deletes, not just
    // newly-added pages.
    if (merged.pages !== localSettings.pages || merged.tombstones !== localSettings.tombstones) {
      const addedCount = merged.pages.length - localSettings.pages.length;
      log(
        addedCount > 0
          ? `BACKGROUND: Merging ${addedCount} new page(s) and applying any newer edits/deletes from remote storage`
          : "BACKGROUND: Applying newer edits/deletes from remote storage",
        "success"
      );
      await writePagesToLocalStorage(merged.pages, localSettings.meta.selectedPage, merged.tombstones);
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

  // React to another signed-in browser's push immediately, rather than
  // waiting on this browser's own reload or the periodic interval.
  browser.storage.sync.onChanged.addListener(function () {
    syncRemoteToLocalStorage();
  });

  setInterval(function () {
    syncRemoteToLocalStorage().finally(syncLocalToRemoteStorage);
  }, SYNC_INTERVAL);

  // Pull before pushing so we never push a stale local page set over
  // what's already in sync storage.
  syncRemoteToLocalStorage().finally(() => {
    getAndApplyHeaderRules();
    syncLocalToRemoteStorage();
  });
}
