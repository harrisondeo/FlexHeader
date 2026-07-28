import browser from "webextension-polyfill";
import { hasUiPreference, setUiPreference, type UiPreferenceKey, type UiPreferenceTypes } from "../storage/uiPreferences";

/**
 * One-time move of a preference from its old browser.storage.local home into
 * the newer localStorage-backed uiPreferences. No-ops once localStorage
 * already has a value for `key`, so this is safe to call on every load.
 */
export async function migrateUiPreference<K extends UiPreferenceKey>(key: K): Promise<void> {
  if (hasUiPreference(key)) {
    return;
  }

  const legacy = await browser.storage.local.get(key);
  const legacyValue = legacy[key] as UiPreferenceTypes[K] | undefined;
  if (legacyValue === undefined) {
    return;
  }

  setUiPreference(key, legacyValue);
  await browser.storage.local.remove(key);
}
