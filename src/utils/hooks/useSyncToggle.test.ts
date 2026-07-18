import { vi } from "vitest";

const browserMock = vi.hoisted(() => ({
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
    sync: {
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

import useSyncToggle from "./useSyncToggle";
import { SETTINGS_V3_META_KEY, PAGE_KEY_PREFIX, SYNC_ENABLED_KEY, ERRORS_STATE_KEY } from "../../constants";
import type { Page, PagesData } from "../domain/schemas";
import type { PageTombstone } from "../domain/pageMerge";

const createArea = () => {
  const store: Record<string, any> = {};
  return {
    store,
    get: vi.fn(async (key: string) => ({ [key]: store[key] })),
    set: vi.fn(async (data: Record<string, any>) => {
      Object.assign(store, data);
    }),
    remove: vi.fn(async () => {}),
  };
};

const makePage = (overrides: Partial<Page> = {}): Page => ({
  id: 0,
  pageId: "local-page",
  name: "Local Page",
  enabled: true,
  keepEnabled: false,
  showHeaderComments: true,
  filtersExpanded: true,
  filters: [],
  headers: [],
  lastModified: 100,
  ...overrides,
});

const defaultPage = makePage({ pageId: "default", name: "Default" });

let local: ReturnType<typeof createArea>;
let sync: ReturnType<typeof createArea>;
let setPagesData: ReturnType<typeof vi.fn>;
let setTombstones: ReturnType<typeof vi.fn>;
let setSyncEnabled: ReturnType<typeof vi.fn>;
let resetHistory: ReturnType<typeof vi.fn>;
let saveToStorages: ReturnType<typeof vi.fn>;
let setAlert: ReturnType<typeof vi.fn>;

const buildToggle = (params: {
  pagesData?: PagesData;
  tombstones?: PageTombstone[];
  syncEnabled?: boolean;
} = {}) => {
  const pagesData: PagesData = params.pagesData ?? { pages: [makePage()], selectedPage: 0 };
  const tombstones: PageTombstone[] = params.tombstones ?? [];

  return useSyncToggle({
    pagesData,
    tombstones,
    setPagesData,
    setTombstones,
    syncEnabled: params.syncEnabled ?? false,
    setSyncEnabled,
    resetHistory,
    saveToStorages,
    alertContext: { alertText: "", alertType: "success", location: "bottom", show: false, setAlert } as any,
    defaultPage,
  } as any);
};

beforeEach(() => {
  vi.clearAllMocks();
  local = createArea();
  sync = createArea();
  browserMock.storage.local.get.mockImplementation(local.get);
  browserMock.storage.local.set.mockImplementation(local.set);
  browserMock.storage.local.remove.mockImplementation(local.remove);
  browserMock.storage.sync.get.mockImplementation(sync.get);
  browserMock.storage.sync.set.mockImplementation(sync.set);
  browserMock.storage.sync.remove.mockImplementation(sync.remove);

  setPagesData = vi.fn();
  setTombstones = vi.fn();
  setSyncEnabled = vi.fn();
  resetHistory = vi.fn();
  saveToStorages = vi.fn().mockResolvedValue(undefined);
  setAlert = vi.fn();
});

describe("toggleSync", () => {
  it("persists the flipped preference to local storage before anything else", async () => {
    // Nothing in sync storage - meta key is absent, so readPageStorage returns null.
    const { toggleSync } = buildToggle({ syncEnabled: false });

    await toggleSync();

    expect(local.store[SYNC_ENABLED_KEY]).toBe(true);
    expect(setSyncEnabled).toHaveBeenCalledWith(true);
  });

  it("shows a plain success alert when enabling sync and there is nothing to merge", async () => {
    const { toggleSync } = buildToggle({ syncEnabled: false });

    await toggleSync();

    expect(setPagesData).not.toHaveBeenCalled();
    expect(setAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: "success", alertText: expect.stringContaining("Sync enabled") })
    );
  });

  it("merges in a page that already exists in sync storage and updates pagesData/tombstones", async () => {
    const remotePage = makePage({ pageId: "remote-page", name: "Remote Page", lastModified: 200 });
    sync.store[SETTINGS_V3_META_KEY] = { version: 3, selectedPage: 0, pageCount: 1 };
    sync.store[`${PAGE_KEY_PREFIX}0`] = remotePage;

    const localPage = makePage({ pageId: "local-page" });
    const { toggleSync } = buildToggle({
      syncEnabled: false,
      pagesData: { pages: [localPage], selectedPage: 0 },
    });

    await toggleSync();

    expect(resetHistory).toHaveBeenCalled();
    expect(setPagesData).toHaveBeenCalledWith(
      expect.objectContaining({
        pages: expect.arrayContaining([
          expect.objectContaining({ pageId: "local-page" }),
          expect.objectContaining({ pageId: "remote-page" }),
        ]),
      })
    );
    expect(saveToStorages).toHaveBeenCalled();
    expect(setAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alertText: expect.stringContaining("merged from other browsers") })
    );
  });

  it("shows an info alert and does not touch pagesData when disabling sync", async () => {
    const { toggleSync } = buildToggle({ syncEnabled: true });

    await toggleSync();

    expect(local.store[SYNC_ENABLED_KEY]).toBe(false);
    expect(setPagesData).not.toHaveBeenCalled();
    expect(setAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: "info", alertText: expect.stringContaining("Sync disabled") })
    );
  });

  it("records an error and shows an error alert if the toggle throws", async () => {
    browserMock.storage.local.set.mockRejectedValueOnce(new Error("disk full"));
    const { toggleSync } = buildToggle({ syncEnabled: false });

    await toggleSync();

    expect(setAlert).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: "error", alertText: expect.stringContaining("Failed to toggle sync") })
    );
    const stored = local.store[ERRORS_STATE_KEY];
    expect(stored.errors[0]).toMatchObject({ category: "sync", message: "disk full" });
  });
});
