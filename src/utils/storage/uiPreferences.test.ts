import { getUiPreference, setUiPreference } from "./uiPreferences";

const TEST_KEY = "test_ui_preference";

beforeEach(() => {
  localStorage.clear();
});

describe("UI preferences", () => {
  it("returns the supplied default when a preference is missing", () => {
    expect(getUiPreference(TEST_KEY, false)).toBe(false);
  });

  it("persists and restores primitive values", () => {
    setUiPreference(TEST_KEY, true);

    expect(getUiPreference(TEST_KEY, false)).toBe(true);
  });

  it("supports structured preferences", () => {
    const preference = { theme: "dark", compact: true };

    setUiPreference(TEST_KEY, preference);

    expect(getUiPreference(TEST_KEY, {})).toEqual(preference);
  });

  it("returns the default when stored data is invalid", () => {
    localStorage.setItem(TEST_KEY, "not-json");

    expect(getUiPreference(TEST_KEY, "default")).toBe("default");
  });
});
