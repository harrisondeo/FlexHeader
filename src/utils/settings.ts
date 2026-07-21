import { useEffect, useState, useCallback, useRef } from "react";
import { useAlert } from "../context/alertContext";
import browser from "webextension-polyfill";
import { SETTINGS_V3_META_KEY, PAGE_KEY_PREFIX, PAGE_TOMBSTONES_KEY, SYNC_ENABLED_KEY, LAST_MERGE_TIME_KEY, LOCAL_MODIFIED_TIME_KEY, HISTORY_ENABLED_KEY } from "../constants";
import { saveToStorage, loadFromStorage, clearStorage, getAllFromStorage, getDataSizeInBytes } from "./storage/storage";
import { log } from "./log";
import { normalizePage } from "./domain/headers";
import { applyTombstones, pruneExpiredTombstones, type PageTombstone } from "./domain/pageMerge";
import { addStoredError, clearStoredErrors } from "./storage/errors";
import usePageHistory from "./hooks/usePageHistory";
import useStoredErrors from "./hooks/useStoredErrors";
import useSyncStatus from "./hooks/useSyncStatus";
import useFilterOperations from "./hooks/useFilterOperations";
import useHeaderOperations from "./hooks/useHeaderOperations";
import usePageOperations from "./hooks/usePageOperations";
import useSyncToggle from "./hooks/useSyncToggle";
import { importSettingsFile } from "./io/importSettings";
import type { Page, PagesData, SettingsV3Meta } from "./domain/schemas";

export * from "./domain/schemas";

export enum SettingsErrorType {
  None = "None",
  SaveError = "SaveError",
}

/**
 * The debouncing logic has been moved into the component to allow access to the timeout ref
 * for handling window unload events
 */

export const defaultPage: Page = {
  id: 0,
  // Fixed (not random) so that two fresh installs on the same sync account
  // recognize each other's untouched default page as the same page instead
  // of forking into a duplicate the first time they sync.
  pageId: "default",
  name: "Default",
  enabled: true,
  keepEnabled: false,
  paused: false,
  showHeaderComments: true,
  filters: [],
  lastModified: 0,
  headers: [
    {
      id: "default-1",
      headerName: "X-Frame-Options",
      headerValue: "ALLOW-FROM https://www.youtube.com/",
      headerComment: "",
      headerEnabled: true,
      headerType: "request",
    },
  ],
};

export const clearStoredSettings = async () => {
  await clearStorage('both');
};

function useFlexHeaderSettings() {
  const [lastError, setLastError] = useState<{ type: SettingsErrorType; time: number }>({ type: SettingsErrorType.None, time: 0 });
  const [pagesData, setPagesData] = useState<PagesData>({
    pages: [defaultPage],
    selectedPage: defaultPage.id,
  });
  const [tombstones, setTombstones] = useState<PageTombstone[]>([]);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [saveVersion, setSaveVersion] = useState(0);
  const isSavingRef = useRef<boolean>(false);
  const hasPendingSaveRef = useRef<boolean>(false);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const alertContext = useAlert();

  const {
    recordHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    clearPendingBursts,
    loadPersistedHistory,
    reconcileAfterMerge,
  } = usePageHistory({ enabled: historyEnabled, pagesData, setPagesData, hasInitialized });

  const { errors, clearErrors, injectError } = useStoredErrors();
  const { lastSyncTime, localModifiedTime } = useSyncStatus();

  const { addFilter, removeFilter, updateFilter } = useFilterOperations({ pagesData, setPagesData, recordHistory });
  const { addHeader, removeHeader, saveHeaders, updateHeader } = useHeaderOperations({ pagesData, setPagesData, recordHistory });
  const { addPage, removePage, updatePage, changeSelectedPage, changePageIndex } = usePageOperations({
    pagesData,
    setPagesData,
    setTombstones,
    defaultPage,
    alertContext,
    recordHistory,
  });

  /**
   * Handles saving data to local storage and manages cleanup of extra pages
   * Syncing to remote storage is now handled by the background service worker
   * @param settings The complete settings data
   * @param tombstonesToSave The current delete tombstones, saved alongside pages
   */
  const saveToStorages = useCallback(async (settings: PagesData, tombstonesToSave: PageTombstone[]) => {
    try {
      // Create metadata
      const metadata: SettingsV3Meta = {
        version: 3,
        selectedPage: settings.selectedPage,
        pageCount: settings.pages.length,
      };

      try {
        log(`SETTINGS: Saving to local storage`, "warning");

        const dataToWrite: Record<string, unknown> = {
          [SETTINGS_V3_META_KEY]: metadata,
          [PAGE_TOMBSTONES_KEY]: pruneExpiredTombstones(tombstonesToSave),
          [LOCAL_MODIFIED_TIME_KEY]: Date.now(),
        };

        settings.pages.forEach((page, index) => {
          const pageKey = `${PAGE_KEY_PREFIX}${index}`;
          const sizeInBytes = getDataSizeInBytes(page);
          const STORAGE_LIMIT = 5242880; // 5MB for local storage

          if (sizeInBytes > STORAGE_LIMIT) {
            alertContext.setAlert({
              alertType: "error",
              alertText: `Page too large (${(sizeInBytes / 1024).toFixed(1)}KB > ${STORAGE_LIMIT / 1024}KB). Please reduce the number of headers.`,
              location: "bottom",
            });
            throw new Error(`Page ${index} exceeds storage limit: ${sizeInBytes} bytes > ${STORAGE_LIMIT} bytes`);
          }

          dataToWrite[pageKey] = page;
        });

        await browser.storage.local.set(dataToWrite);

        // Clear save errors once a successful save has completed
        await clearStoredErrors("save");

        // Clean up any extra pages from storage
        try {
          const allData = await getAllFromStorage('local');
          const pageKeys = Object.keys(allData)
            .filter(key => key.startsWith(PAGE_KEY_PREFIX))
            .filter(key => {
              const pageIndex = parseInt(key.replace(PAGE_KEY_PREFIX, ''));
              return pageIndex >= settings.pages.length;
            });

          if (pageKeys.length > 0) {
            log(`SETTINGS: Cleaning up ${pageKeys.length} extra keys from local storage`, "info");
            await browser.storage.local.remove(pageKeys);
          }
        } catch (cleanupError) {
          log(`SETTINGS: Error cleaning up extra pages from local storage: ${cleanupError}`, "error");
          // Don't fail the whole operation for cleanup errors
        }

      } catch (error) {
        console.error(`Failed to save to local storage:`, error);
        throw error; // Re-throw for local storage errors
      } finally {
        log(`SETTINGS: Finished saving to local storage`, "success");
      }

      // On success, clear error state
      setLastError({ type: SettingsErrorType.None, time: 0 });
    } catch (error) {
      console.error(`Failed to save settings:`, error);
      setLastError({ type: SettingsErrorType.SaveError, time: Date.now() });
      const message = error instanceof Error ? error.message : "Failed to save settings";
      await addStoredError(
        "save",
        message,
        error instanceof Error ? error.stack : undefined
      );
      alertContext.setAlert({
        alertType: "error",
        alertText: "Failed to save settings. Please try again.",
        location: "bottom",
      });
    }
  }, [alertContext]);

  const { toggleSync } = useSyncToggle({
    pagesData,
    tombstones,
    setPagesData,
    setTombstones,
    syncEnabled,
    setSyncEnabled,
    resetHistory,
    saveToStorages,
    alertContext,
    defaultPage,
  });

  useEffect(() => {
    const selectedPage = pagesData.pages.find((page) => page.enabled);
    if (selectedPage && !selectedPage.paused) {
      const activeHeaders = selectedPage.headers.filter(
        (header) => header.headerEnabled
      );
      browser.action.setBadgeText({
        text: activeHeaders.length.toString(),
      });
    } else {
      browser.action.setBadgeText({
        text: "",
      });
    }
  }, [pagesData]);

  // Create a ref to track the previous pages data to prevent unnecessary saves
  const prevPagesDataRef = useRef<string | null>(null);

  // Main save effect that watches for data changes
  useEffect(() => {
    if (!hasInitialized) return;

    if (isSavingRef.current) {
      hasPendingSaveRef.current = true;
      return;
    }

    // Stringify current data for comparison
    const currentDataString = JSON.stringify(pagesData);

    // Only save if data has changed
    if (prevPagesDataRef.current === currentDataString) {
      return;
    }

    // Block recent saves after errors to prevent infinite error loops
    if (lastError.type === SettingsErrorType.SaveError && Date.now() - lastError.time < 60 * 1000) {
      console.warn("Skipping save: recent save error within last minute.");
      alertContext.setAlert({
        alertType: "error",
        alertText: "Changes not saved due to recent error. Please try again later.",
        location: "bottom",
      });
      return;
    }

    // Update reference for next comparison
    prevPagesDataRef.current = currentDataString;

    // Start save operation
    isSavingRef.current = true;
    log("SETTINGS: Saving changes to storage", "warning");

    // Make a deep copy to avoid mutation issues
    const settingsToSave = JSON.parse(JSON.stringify(pagesData));

    // Save to local storage immediately
    saveToStorages(settingsToSave, tombstones)
      .finally(() => {
        setTimeout(() => {
          isSavingRef.current = false;
          log("SETTINGS: Changes saved successfully", "success");
          if (hasPendingSaveRef.current) {
            hasPendingSaveRef.current = false;
            setSaveVersion((version) => version + 1);
          }
        }, 0);
      });
  }, [pagesData, tombstones, hasInitialized, lastError, saveToStorages, alertContext, saveVersion]);

  /**
   * Loads the settings from storage and sets the state
   * @param isExternalReload True when triggered by the LAST_MERGE_TIME_KEY
   * listener (a background sync merge landed), as opposed to the initial
   * mount call - only that case should reconcile undo/redo history, since
   * retrieveSettings's identity (and so the mount effect that calls it) gets
   * recreated on unrelated re-renders too (it depends on alertContext via
   * saveToStorages, and alertContext changes on every alert), which would
   * otherwise touch history after almost any user action that shows a toast.
   */
  const retrieveSettings = useCallback(async (isExternalReload = false) => {
    if (isExternalReload) {
      // A (re)load replaces pagesData wholesale from an external source. Any
      // in-flight debounce burst was keyed against the pre-reload pagesData,
      // so drop it - undo/redo history itself is reconciled below, once the
      // merged pages/tombstones are known, since a merge only invalidates
      // the specific stack entries whose pages it actually touched or
      // removed (see reconcileHistoryAfterMerge in usePageHistory).
      clearPendingBursts();
    }

    // Load dark mode setting - local only. This is a per-device preference
    // (a user may want dark mode on one browser and light on another), not
    // shared truth, so it's never synced (see background.ts's
    // syncLocalToRemoteStorage).
    try {
      const darkModeValue = await loadFromStorage("darkMode", false, ['local']);
      setDarkModeEnabled(darkModeValue);

      // If darkMode wasn't found in either storage, save the default value
      if (darkModeValue === false) {
        await saveToStorage("darkMode", false, 'local');
      }
    } catch (error) {
      console.error("Failed to load dark mode setting:", error);
    }

    // Load sync preference
    try {
      const syncEnabledValue = await loadFromStorage(SYNC_ENABLED_KEY, false, ['local']);
      setSyncEnabled(syncEnabledValue);
    } catch (error) {
      console.error("Failed to load sync preference:", error);
    }

    // Load undo/redo feature preference - local only, per-device.
    try {
      const historyEnabledValue = await loadFromStorage(HISTORY_ENABLED_KEY, true, ['local']);
      setHistoryEnabled(historyEnabledValue);
    } catch (error) {
      console.error("Failed to load undo/redo history preference:", error);
    }

    // Restore undo/redo history - local only, per-device (see UNDO_STACK_KEY).
    // Skipped on an external reload: that path reconciles the in-memory
    // stacks (already restored at mount) against the merge instead, via
    // reconcileAfterMerge below.
    if (!isExternalReload) {
      await loadPersistedHistory();
    }

    try {
      // First try to get metadata from local storage (preferred source), then sync
      const meta = await loadFromStorage<SettingsV3Meta | null>(SETTINGS_V3_META_KEY, null, ['local', 'sync']);
      let storageType: 'local' | 'sync' = 'local';

      // Determine which storage actually had the metadata
      try {
        const localMeta = await browser.storage.local.get(SETTINGS_V3_META_KEY);
        if (!localMeta[SETTINGS_V3_META_KEY]) {
          storageType = 'sync';
        }
      } catch {
        storageType = 'sync';
      }

      if (meta) {
        log("SETTINGS: Loading settings from distributed storage format", "info");

        // Load all pages
        const pagePromises = [];
        for (let i = 0; i < meta.pageCount; i++) {
          const pageKey = `${PAGE_KEY_PREFIX}${i}`;
          pagePromises.push(loadFromStorage<Page | null>(pageKey, null, [storageType]));
        }

        const [pagesWithNulls, loadedTombstones] = await Promise.all([
          Promise.all(pagePromises),
          loadFromStorage<PageTombstone[]>(PAGE_TOMBSTONES_KEY, [], [storageType]),
        ]);
        let pages: Page[] = pagesWithNulls
          .filter((page): page is Page => page !== null) // Remove any null/undefined pages with type guard
          .map(normalizePage)
          // Backfilled here (not in normalizePage) so it happens once and gets
          // persisted by the save effect below - normalizePage also runs on
          // background.ts's non-persisting reads, which would otherwise
          // re-fabricate a throwaway id every time.
          .map((page) => ({ ...page, pageId: page.pageId || crypto.randomUUID() }));

        // This device has no local data yet and is bootstrapping straight from
        // sync - apply tombstones directly (not the full mergeSyncState/
        // mergePages path, which would mark every incoming page disabled;
        // there's no existing local selection to protect here).
        if (storageType === 'sync') {
          pages = applyTombstones(pages, loadedTombstones);
        }

        setTombstones(loadedTombstones);

        if (isExternalReload) {
          reconcileAfterMerge(pages, loadedTombstones);
        }

        if (pages.length === 0) {
          // No pages found, use default
          setPagesData({
            pages: [defaultPage],
            selectedPage: defaultPage.id,
          });
        } else {
          setPagesData({
            pages,
            selectedPage: meta.selectedPage,
          });
          // If loaded from sync, save a copy to local storage
          if (storageType === 'sync') {
            log("SETTINGS: Saving sync data to local storage", "info");
            // Save to local storage
            await saveToStorages({
              pages,
              selectedPage: meta.selectedPage,
            }, loadedTombstones);
          }
        }

        setHasInitialized(true);
        return;
      }

      // No existing settings found, use default
      setPagesData({
        pages: [defaultPage],
        selectedPage: defaultPage.id,
      });
      setTombstones([]);
      // No merged-pages info to reconcile history against here - fall back
      // to the old conservative wipe rather than risk restoring a snapshot
      // for pages that turn out not to exist.
      if (isExternalReload) {
        resetHistory();
      }
      setHasInitialized(true);

    } catch (error) {
      console.error("Failed to retrieve settings:", error);
      const message = error instanceof Error ? error.message : "Failed to load settings";
      await addStoredError(
        "sync",
        message,
        error instanceof Error ? error.stack : undefined
      );
      alertContext.setAlert({
        alertType: "error",
        alertText: "Failed to load settings. Using default configuration.",
        location: "bottom",
      });

      setPagesData({
        pages: [defaultPage],
        selectedPage: defaultPage.id,
      });
      setTombstones([]);
      if (isExternalReload) {
        resetHistory();
      }
      setHasInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveToStorages]);

  /**
   * Clears the storage and sets the state to the default page
   */
  const clear = async () => {
    // Clear both storage types
    await clearStorage('both');

    setPagesData({
      pages: [defaultPage],
      selectedPage: defaultPage.id,
    });
    setTombstones([]);
    resetHistory();
  };

  /**
   * Dark Mode
   */
  const toggleDarkMode = async () => {
    try {
      const darkMode = await loadFromStorage("darkMode", false, ['local']);
      const newDarkMode = !darkMode;

      // Save to local storage only, background service worker will sync it
      await saveToStorage("darkMode", newDarkMode, 'local');
      setDarkModeEnabled(newDarkMode);
    } catch (error) {
      console.error("Error toggling dark mode:", error);
    }
  };

  /**
   * Toggle the undo/redo history feature on or off (per-device preference).
   */
  const toggleHistoryEnabled = async () => {
    try {
      const newHistoryEnabled = !historyEnabled;

      await saveToStorage(HISTORY_ENABLED_KEY, newHistoryEnabled, 'local');
      setHistoryEnabled(newHistoryEnabled);
    } catch (error) {
      console.error("Error toggling undo/redo history:", error);
    }
  };

  const importSettings = (file: File): Promise<{ warnings: string[] }> =>
    importSettingsFile(file, { setPagesData, alertContext });

  useEffect(() => {
    retrieveSettings();
  }, [retrieveSettings]);

  // LAST_MERGE_TIME_KEY is stamped only by the background worker's merge
  // writes, never by this hook's own saves - an unambiguous "reload" signal
  // that a page-count comparison couldn't give us (it misses in-place edits).
  useEffect(() => {
    const listener = (changes: Record<string, browser.Storage.StorageChange>) => {
      if (LAST_MERGE_TIME_KEY in changes) {
        log("SETTINGS: Detected changes merged in from sync storage, reloading", "info");
        retrieveSettings(true);
      }
    };

    browser.storage.local.onChanged.addListener(listener);
    return () => browser.storage.local.onChanged.removeListener(listener);
  }, [retrieveSettings]);

  return {
    pages: pagesData.pages,
    selectedPage: pagesData.selectedPage,
    darkModeEnabled,
    syncEnabled,
    isSaving: isSavingRef.current,
    lastSyncTime,
    localModifiedTime,
    errors,
    clearErrors,
    injectError,
    addPage,
    removePage,
    updatePage,
    addHeader,
    removeHeader,
    updateHeader,
    saveHeaders,
    addFilter,
    removeFilter,
    updateFilter,
    clear,
    changeSelectedPage,
    changePageIndex,
    importSettings,
    toggleDarkMode,
    toggleSync,
    historyEnabled,
    toggleHistoryEnabled,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

export default useFlexHeaderSettings;
