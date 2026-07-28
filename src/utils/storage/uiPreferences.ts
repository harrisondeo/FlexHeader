import { DARK_MODE_KEY, HISTORY_ENABLED_KEY, PAGES_LIST_COLLAPSED_KEY } from "../../constants";

/**
 * Maps known UI preference keys to their persisted value types. This is the
 * single source of truth for which keys are valid - add new keys here so
 * getUiPreference/setUiPreference enforce the correct type at compile time
 * and reject typos or one-off keys that would silently no-op.
 */
interface UiPreferenceTypes {
  [PAGES_LIST_COLLAPSED_KEY]: boolean;
  [DARK_MODE_KEY]: boolean;
  [HISTORY_ENABLED_KEY]: boolean;
}

type UiPreferenceKey = keyof UiPreferenceTypes;

export function getUiPreference<K extends UiPreferenceKey>(
  key: K,
  defaultValue: UiPreferenceTypes[K]
): UiPreferenceTypes[K] {
  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue;
    }
    return JSON.parse(value) as UiPreferenceTypes[K];
  } catch {
    // UI preference persistence should never block the related interaction.
    return defaultValue;
  }
}

export function setUiPreference<K extends UiPreferenceKey>(
  key: K,
  value: UiPreferenceTypes[K]
): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // UI preference persistence should never block the related interaction.
  }
}

export function hasUiPreference<K extends UiPreferenceKey>(key: K): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
