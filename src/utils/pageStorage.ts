import type browser from "webextension-polyfill";
import { SETTINGS_V3_META_KEY, PAGE_KEY_PREFIX, PAGE_TOMBSTONES_KEY } from "../constants";
import type { Page, SettingsV3Meta } from "./schemas";
import { normalizePage } from "./headers";
import type { PageTombstone } from "./pageMerge";

export interface StoredPageSettings {
  meta: SettingsV3Meta;
  pages: Page[];
  tombstones: PageTombstone[];
}

/**
 * Reads the v3 distributed page storage format (one `page_N` key per page,
 * plus the meta and tombstones keys) from a single storage area. Shared by
 * the background worker's push/pull cycle and the popup's enable-sync merge
 * path so both read pages the same way instead of maintaining their own
 * near-identical fetch loop that could drift apart.
 */
export async function readPageStorage(
  area: browser.Storage.StorageArea
): Promise<StoredPageSettings | null> {
  const metaResult = await area.get(SETTINGS_V3_META_KEY);
  const meta = metaResult[SETTINGS_V3_META_KEY] as SettingsV3Meta | undefined;

  if (!meta) {
    return null;
  }

  const pagePromises = [];
  for (let i = 0; i < meta.pageCount; i++) {
    pagePromises.push(area.get(`${PAGE_KEY_PREFIX}${i}`));
  }

  const [pageResults, tombstonesResult] = await Promise.all([
    Promise.all(pagePromises),
    area.get(PAGE_TOMBSTONES_KEY),
  ]);
  const pages = pageResults
    .map((result, index) => result[`${PAGE_KEY_PREFIX}${index}`] as Page)
    .filter(Boolean)
    .map(normalizePage);
  const tombstones = (tombstonesResult[PAGE_TOMBSTONES_KEY] as PageTombstone[] | undefined) ?? [];

  return { meta, pages, tombstones };
}
