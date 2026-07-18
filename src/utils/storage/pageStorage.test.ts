import { readPageStorage } from "./pageStorage";
import { SETTINGS_V3_META_KEY, PAGE_KEY_PREFIX, PAGE_TOMBSTONES_KEY } from "../../constants";
import type { Page, SettingsV3Meta } from "../domain/schemas";

const createArea = (store: Record<string, any>) => ({
  get: vi.fn(async (key: string) => ({ [key]: store[key] })),
});

const rawPage = (overrides: Partial<Page> = {}): any => ({
  id: 0,
  pageId: "page-1",
  name: "Page 1",
  enabled: true,
  keepEnabled: false,
  headers: [],
  filters: [],
  ...overrides,
});

describe("readPageStorage", () => {
  it("returns null when no meta key is present", async () => {
    const area = createArea({});

    const result = await readPageStorage(area as any);

    expect(result).toBeNull();
  });

  it("reads meta, all page_N keys up to pageCount, and normalizes each page", async () => {
    const meta: SettingsV3Meta = { version: 3, selectedPage: 0, pageCount: 2 };
    const area = createArea({
      [SETTINGS_V3_META_KEY]: meta,
      [`${PAGE_KEY_PREFIX}0`]: rawPage({ pageId: "page-0" }),
      [`${PAGE_KEY_PREFIX}1`]: rawPage({ pageId: "page-1" }),
    });

    const result = await readPageStorage(area as any);

    expect(result?.meta).toEqual(meta);
    expect(result?.pages.map((p) => p.pageId)).toEqual(["page-0", "page-1"]);
    // normalizePage fills in defaults not present on the raw stored page
    expect(result?.pages[0].showHeaderComments).toBe(true);
    expect(result?.pages[0].lastModified).toBe(0);
  });

  it("skips page_N keys that are missing from storage instead of returning holes", async () => {
    const meta: SettingsV3Meta = { version: 3, selectedPage: 0, pageCount: 3 };
    const area = createArea({
      [SETTINGS_V3_META_KEY]: meta,
      [`${PAGE_KEY_PREFIX}0`]: rawPage({ pageId: "page-0" }),
      // page_1 missing entirely
      [`${PAGE_KEY_PREFIX}2`]: rawPage({ pageId: "page-2" }),
    });

    const result = await readPageStorage(area as any);

    expect(result?.pages.map((p) => p.pageId)).toEqual(["page-0", "page-2"]);
  });

  it("defaults tombstones to an empty array when the key is absent", async () => {
    const meta: SettingsV3Meta = { version: 3, selectedPage: 0, pageCount: 0 };
    const area = createArea({ [SETTINGS_V3_META_KEY]: meta });

    const result = await readPageStorage(area as any);

    expect(result?.pages).toEqual([]);
    expect(result?.tombstones).toEqual([]);
  });

  it("returns stored tombstones as-is", async () => {
    const meta: SettingsV3Meta = { version: 3, selectedPage: 0, pageCount: 0 };
    const tombstones = [{ pageId: "deleted-1", deletedAt: 123 }];
    const area = createArea({
      [SETTINGS_V3_META_KEY]: meta,
      [PAGE_TOMBSTONES_KEY]: tombstones,
    });

    const result = await readPageStorage(area as any);

    expect(result?.tombstones).toEqual(tombstones);
  });
});
