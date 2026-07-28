import browser from "webextension-polyfill";
import { HISTORY_ENABLED_KEY } from "../../constants";
import { hasUiPreference, setUiPreference } from "../storage/uiPreferences";

/**
 * One-time migration for existing users: the undo/redo feature toggle used
 * to live in browser.storage.local before this preference moved to
 * localStorage-backed uiPreferences. Only consults the legacy value when
 * localStorage has never recorded one, so this doesn't stomp a preference
 * already set post-migration. Safe to call on every load - it's a no-op
 * once migrated.
 */
export async function migrateHistoryEnabledPreference(): Promise<void> {
  if (hasUiPreference(HISTORY_ENABLED_KEY)) {
    return;
  }

  const legacy = await browser.storage.local.get(HISTORY_ENABLED_KEY);
  if (legacy[HISTORY_ENABLED_KEY] === undefined) {
    return;
  }

  setUiPreference(HISTORY_ENABLED_KEY, legacy[HISTORY_ENABLED_KEY] as boolean);
  await browser.storage.local.remove(HISTORY_ENABLED_KEY);
}
