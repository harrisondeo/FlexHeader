export const getUiPreference = <T>(key: string, defaultValue: T): T => {
  try {
    const storedValue = localStorage.getItem(key);
    return storedValue === null ? defaultValue : (JSON.parse(storedValue) as T);
  } catch {
    return defaultValue;
  }
};

export const setUiPreference = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // UI preference persistence should never block the related interaction.
  }
};
