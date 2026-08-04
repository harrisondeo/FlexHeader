import { getUiPreference, setUiPreference } from "./uiPreferences";
import { PAGES_LIST_COLLAPSED_KEY, SLIM_MODE_KEY } from "../../constants";

beforeEach(() => {
  localStorage.clear();
});

describe("UI preferences", () => {
  it("returns the supplied default when a preference is missing", () => {
    expect(getUiPreference(PAGES_LIST_COLLAPSED_KEY, false)).toBe(false);
  });

  it("persists and restores primitive values", () => {
    setUiPreference(PAGES_LIST_COLLAPSED_KEY, true);

    expect(getUiPreference(PAGES_LIST_COLLAPSED_KEY, false)).toBe(true);
  });

  it("persists the slim mode preference", () => {
    setUiPreference(SLIM_MODE_KEY, true);

    expect(getUiPreference(SLIM_MODE_KEY, false)).toBe(true);
  });

  it("returns the default when stored data is invalid", () => {
    localStorage.setItem(PAGES_LIST_COLLAPSED_KEY, "not-json");

    expect(getUiPreference(PAGES_LIST_COLLAPSED_KEY, false)).toBe(false);
  });
});
