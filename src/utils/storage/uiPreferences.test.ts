import { PAGES_LIST_COLLAPSED_KEY } from "../../constants";
import {
  getPagesListCollapsed,
  setPagesListCollapsed,
} from "./uiPreferences";

beforeEach(() => {
  localStorage.clear();
});

describe("pages list preference", () => {
  it("defaults to expanded", () => {
    expect(getPagesListCollapsed()).toBe(false);
  });

  it("persists the collapsed state", () => {
    setPagesListCollapsed(true);

    expect(localStorage.getItem(PAGES_LIST_COLLAPSED_KEY)).toBe("true");
    expect(getPagesListCollapsed()).toBe(true);
  });

  it("persists the expanded state", () => {
    localStorage.setItem(PAGES_LIST_COLLAPSED_KEY, "true");

    setPagesListCollapsed(false);

    expect(getPagesListCollapsed()).toBe(false);
  });
});
