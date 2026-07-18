import { useEffect, useState } from "react";
import browser from "webextension-polyfill";
import { LAST_SYNC_TIME_KEY, LOCAL_MODIFIED_TIME_KEY } from "../../constants";
import { loadFromStorage } from "../storage/storage";

/**
 * Comparing localModifiedTime (bumped on every local write, by this hook and
 * by the background worker) against LAST_SYNC_TIME_KEY (stamped only after a
 * successful push) tells the UI "pending" vs "synced" without needing a new
 * dedicated flag - both timestamps already existed, just weren't read
 * anywhere until now.
 */
function useSyncStatus() {
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [localModifiedTime, setLocalModifiedTime] = useState<number | null>(null);

  useEffect(() => {
    const loadSyncStatus = async () => {
      const [syncTime, modifiedTime] = await Promise.all([
        loadFromStorage<number | null>(LAST_SYNC_TIME_KEY, null, ['local']),
        loadFromStorage<number | null>(LOCAL_MODIFIED_TIME_KEY, null, ['local']),
      ]);
      setLastSyncTime(syncTime);
      setLocalModifiedTime(modifiedTime);
    };
    loadSyncStatus();

    const listener = (changes: Record<string, browser.Storage.StorageChange>) => {
      if (LAST_SYNC_TIME_KEY in changes) {
        setLastSyncTime(changes[LAST_SYNC_TIME_KEY].newValue as number | null);
      }
      if (LOCAL_MODIFIED_TIME_KEY in changes) {
        setLocalModifiedTime(changes[LOCAL_MODIFIED_TIME_KEY].newValue as number | null);
      }
    };

    browser.storage.local.onChanged.addListener(listener);
    return () => browser.storage.local.onChanged.removeListener(listener);
  }, []);

  return { lastSyncTime, localModifiedTime };
}

export default useSyncStatus;
