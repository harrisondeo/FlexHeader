import { vi } from "vitest";

const browserMock = vi.hoisted(() => ({
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
}));

vi.mock("webextension-polyfill", () => ({
  default: browserMock,
  ...browserMock,
}));

import { DARK_MODE_KEY } from "../../constants";
import { getUiPreference, hasUiPreference } from "../storage/uiPreferences";
import { migrateUiPreference } from "./uiPreferenceMigration";

const createArea = () => {
  const store: Record<string, any> = {};
  return {
    store,
    get: vi.fn(async (key: string) => ({ [key]: store[key] })),
    remove: vi.fn(async (key: string) => {
      delete store[key];
    }),
  };
};

let area: ReturnType<typeof createArea>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  area = createArea();
  browserMock.storage.local.get.mockImplementation(area.get);
  browserMock.storage.local.remove.mockImplementation(area.remove);
});

describe("migrateUiPreference", () => {
  it("moves a legacy value into localStorage and removes it from browser.storage.local", async () => {
    area.store[DARK_MODE_KEY] = true;

    await migrateUiPreference(DARK_MODE_KEY);

    expect(getUiPreference(DARK_MODE_KEY, false)).toBe(true);
    expect(area.remove).toHaveBeenCalledWith(DARK_MODE_KEY);
  });

  it("migrates a legacy value of false, not just truthy values", async () => {
    area.store[DARK_MODE_KEY] = false;

    await migrateUiPreference(DARK_MODE_KEY);

    expect(hasUiPreference(DARK_MODE_KEY)).toBe(true);
    expect(getUiPreference(DARK_MODE_KEY, true)).toBe(false);
  });

  it("does nothing when there is no legacy value", async () => {
    await migrateUiPreference(DARK_MODE_KEY);

    expect(hasUiPreference(DARK_MODE_KEY)).toBe(false);
    expect(area.remove).not.toHaveBeenCalled();
  });

  it("does not re-read browser.storage.local once already migrated", async () => {
    localStorage.setItem(DARK_MODE_KEY, "true");

    await migrateUiPreference(DARK_MODE_KEY);

    expect(area.get).not.toHaveBeenCalled();
    expect(area.remove).not.toHaveBeenCalled();
  });
});
