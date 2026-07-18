import type { Dispatch, SetStateAction } from "react";
import browser from "webextension-polyfill";
import type { AlertContextType } from "../../context/alertContext";
import { SYNC_ENABLED_KEY } from "../../constants";
import { saveToStorage } from "../storage/storage";
import { log } from "../log";
import { addStoredError } from "../storage/errors";
import { mergeSyncState, type PageTombstone } from "../domain/pageMerge";
import { readPageStorage } from "../storage/pageStorage";
import type { Page, PagesData } from "../domain/schemas";

interface UseSyncToggleParams {
  pagesData: PagesData;
  tombstones: PageTombstone[];
  setPagesData: Dispatch<SetStateAction<PagesData>>;
  setTombstones: Dispatch<SetStateAction<PageTombstone[]>>;
  syncEnabled: boolean;
  setSyncEnabled: Dispatch<SetStateAction<boolean>>;
  resetHistory: () => void;
  saveToStorages: (settings: PagesData, tombstonesToSave: PageTombstone[]) => Promise<void>;
  alertContext: AlertContextType;
  defaultPage: Page;
}

/**
 * Owns the sync on/off toggle, including the enable-sync merge against
 * whatever's already in sync storage. Extracted out of useFlexHeaderSettings
 * since it's a single self-contained user action, distinct from the
 * background worker's continuous pull/push (see useSyncStatus for that).
 */
function useSyncToggle({
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
}: UseSyncToggleParams) {
  /**
   * Toggle sync feature
   * When enabling sync, merges sync data with local data to avoid data loss
   */
  const toggleSync = async () => {
    try {
      const newSyncEnabled = !syncEnabled;

      // Save sync preference first to avoid race conditions with auto-save
      await saveToStorage(SYNC_ENABLED_KEY, newSyncEnabled, 'local');
      setSyncEnabled(newSyncEnabled);

      if (newSyncEnabled) {
        // Enabling sync - merge with whatever already exists in sync storage.
        // Runs unconditionally (no one-shot "already migrated" gate) since
        // mergeSyncState is idempotent - a no-op merge is cheap and this way
        // any tombstones/edits made while sync was off still reconcile
        // immediately on re-enable instead of waiting for the next interval.
        log("SETTINGS: Enabling sync, checking for existing sync data to merge", "info");

        const syncSettings = await readPageStorage(browser.storage.sync);

        const merged = mergeSyncState(
          { pages: pagesData.pages, tombstones },
          { pages: syncSettings?.pages ?? [], tombstones: syncSettings?.tombstones ?? [] },
          defaultPage
        );

        const pagesChanged = merged.pages !== pagesData.pages;
        const tombstonesChanged = merged.tombstones !== tombstones;
        let selectedPage = pagesData.selectedPage;

        if (pagesChanged) {
          // Try to preserve the selected page, or select the first enabled page
          const currentSelectedPage = pagesData.pages[pagesData.selectedPage];
          let newSelectedPage = currentSelectedPage
            ? merged.pages.findIndex((p) => p.name === currentSelectedPage.name)
            : -1;
          if (newSelectedPage === -1) {
            newSelectedPage = merged.pages.findIndex((p) => p.enabled);
          }
          if (newSelectedPage === -1) {
            newSelectedPage = 0; // fallback
          }
          selectedPage = newSelectedPage;

          // An externally-merged view, not a user edit - clear history so
          // undo can't revert back through a cross-browser merge.
          resetHistory();
          setPagesData({ pages: merged.pages, selectedPage });
        }

        if (tombstonesChanged) {
          setTombstones(merged.tombstones);
        }

        if (pagesChanged || tombstonesChanged) {
          const newPagesCount = merged.pages.length - pagesData.pages.length;
          log(`SETTINGS: Merged sync storage data (${Math.max(newPagesCount, 0)} new page(s))`, "info");
          await saveToStorages({ pages: merged.pages, selectedPage }, merged.tombstones);

          alertContext.setAlert({
            alertType: "info",
            alertText: newPagesCount > 0
              ? `Sync enabled! ${newPagesCount} page(s) merged from other browsers.`
              : "Sync enabled! Existing pages were updated from other browsers.",
            location: "bottom",
          });
        } else {
          alertContext.setAlert({
            alertType: "success",
            alertText: "Sync enabled! Your settings will now sync across browsers.",
            location: "bottom",
          });
        }
      } else {
        // Disabling sync
        alertContext.setAlert({
          alertType: "info",
          alertText: "Sync disabled. Settings will only be stored locally.",
          location: "bottom",
        });
      }
    } catch (error) {
      console.error("Error toggling sync:", error);
      const message = error instanceof Error ? error.message : "Failed to toggle sync";
      await addStoredError(
        "sync",
        message,
        error instanceof Error ? error.stack : undefined
      );
      alertContext.setAlert({
        alertType: "error",
        alertText: "Failed to toggle sync. Please try again.",
        location: "bottom",
      });
    }
  };

  return { toggleSync };
}

export default useSyncToggle;
