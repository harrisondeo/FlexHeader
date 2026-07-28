import browser from "webextension-polyfill";
import { DARK_MODE_KEY } from "../../constants";
import { hasUiPreference, setUiPreference } from "../storage/uiPreferences";

/**
 * One-time migration for existing users: darkMode used to live in
 * browser.storage.local before this preference moved to localStorage-backed
 * uiPreferences. Only consults the legacy value when localStorage has never
 * recorded one, so this doesn't stomp a preference already set
 * post-migration. Safe to call on every load - it's a no-op once migrated.
 */
export async function migrateDarkModePreference(): Promise<void> {
  if (hasUiPreference(DARK_MODE_KEY)) {
    return;
  }

  const legacy = await browser.storage.local.get(DARK_MODE_KEY);
  if (legacy[DARK_MODE_KEY] === undefined) {
    return;
  }

  setUiPreference(DARK_MODE_KEY, legacy[DARK_MODE_KEY] as boolean);
  await browser.storage.local.remove(DARK_MODE_KEY);
}
