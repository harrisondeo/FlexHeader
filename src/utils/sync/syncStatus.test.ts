import { getSyncStatus } from "./syncStatus";

describe("getSyncStatus", () => {
  const now = 1_000_000;

  it("reports not yet synced when neither timestamp exists", () => {
    expect(getSyncStatus(null, null, now)).toEqual({ label: "Not yet synced", pending: false });
  });

  it("reports pending when there's a local edit but no sync has ever happened", () => {
    expect(getSyncStatus(null, now - 1_000, now)).toEqual({ label: "Sync pending...", pending: true });
  });

  it("reports pending when the local edit is newer than the last sync", () => {
    const lastSyncTime = now - 10_000;
    const localModifiedTime = now - 1_000;
    expect(getSyncStatus(lastSyncTime, localModifiedTime, now)).toEqual({
      label: "Sync pending...",
      pending: true,
    });
  });

  it("reports synced with a relative time when the last sync is newer than the local edit", () => {
    const lastSyncTime = now - 1_000;
    const localModifiedTime = now - 10_000;
    expect(getSyncStatus(lastSyncTime, localModifiedTime, now)).toEqual({
      label: "Synced just now",
      pending: false,
    });
  });

  it("reports synced when there's no local edit at all", () => {
    const lastSyncTime = now - 5 * 60_000;
    expect(getSyncStatus(lastSyncTime, null, now)).toEqual({
      label: "Synced 5m ago",
      pending: false,
    });
  });

  it("treats an equal local-modified and last-sync timestamp as synced, not pending", () => {
    expect(getSyncStatus(now, now, now)).toEqual({ label: "Synced just now", pending: false });
  });
});
