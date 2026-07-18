import { formatRelativeTime } from "./formatRelativeTime";

export interface SyncStatus {
  label: string;
  pending: boolean;
}

/**
 * Derives a user-facing sync status from two timestamps that already existed
 * in storage but were never read anywhere: `localModifiedTime` (bumped on
 * every local write, by both the popup and the background worker) and
 * `lastSyncTime` (stamped only after a successful push to sync storage).
 * If the local write is newer than the last confirmed push, there's a change
 * sitting locally that hasn't been confirmed synced yet - "pending", not
 * "synced", so a slow sync never silently looks the same as a fast one.
 */
export const getSyncStatus = (
  lastSyncTime: number | null,
  localModifiedTime: number | null,
  now: number = Date.now()
): SyncStatus => {
  const pending = localModifiedTime !== null && (lastSyncTime === null || localModifiedTime > lastSyncTime);

  if (pending) {
    return { label: "Sync pending...", pending: true };
  }

  if (lastSyncTime !== null) {
    return { label: `Synced ${formatRelativeTime(lastSyncTime, now)}`, pending: false };
  }

  return { label: "Not yet synced", pending: false };
};
