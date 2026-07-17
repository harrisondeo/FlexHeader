import { describe, it, expect, vi } from "vitest";
import type { Page } from "./settings";
import { normalizePage } from "./headers";

// Mock log
vi.mock("./log", () => ({
  log: vi.fn(),
}));

// Simple mergePages function reflecting our settings.ts mergePages logic
const mergePagesForTesting = (localPages: Page[], syncPages: Page[]): Page[] => {
  const localPagesMap = new Map<string, Page>();
  localPages.forEach(page => {
    localPagesMap.set(page.name, page);
  });

  const mergedPagesList = [...localPages];

  syncPages.forEach((syncPage) => {
    const localPage = localPagesMap.get(syncPage.name);
    if (!localPage) {
      mergedPagesList.push({
        ...syncPage,
        enabled: false,
      });
    } else {
      const localTime = localPage.lastModified ?? 0;
      const syncTime = syncPage.lastModified ?? 0;

      if (syncTime > localTime) {
        const index = mergedPagesList.findIndex(p => p.name === syncPage.name);
        if (index !== -1) {
          mergedPagesList[index] = {
            ...syncPage,
            enabled: localPage.enabled, // Preserve local enabled state (device-specific)
          };
        }
      }
    }
  });

  return mergedPagesList.map((page, index) => ({
    ...page,
    id: index,
  }));
};

describe("Sync Conflict Resolution & Merging", () => {
  const localPageOlder: Page = normalizePage({
    id: 0,
    name: "Default",
    enabled: true,
    keepEnabled: false,
    headers: [{ id: "1", enabled: true, headerName: "X-Local", headerValue: "Old", headerType: "request" }],
    lastModified: 1000,
  });

  const remotePageNewer: Page = normalizePage({
    id: 0,
    name: "Default",
    enabled: false,
    keepEnabled: false,
    headers: [{ id: "1", enabled: true, headerName: "X-Local", headerValue: "New", headerType: "request" }],
    lastModified: 2000,
  });

  const localPageNewer: Page = normalizePage({
    id: 0,
    name: "Custom",
    enabled: true,
    keepEnabled: false,
    headers: [],
    lastModified: 5000,
  });

  const remotePageOlder: Page = normalizePage({
    id: 1,
    name: "Custom",
    enabled: false,
    keepEnabled: false,
    headers: [{ id: "1", enabled: true, headerName: "X-Old", headerValue: "Ignored", headerType: "request" }],
    lastModified: 3000,
  });

  it("should overwrite local page with remote page when remote has a newer lastModified timestamp", () => {
    const merged = mergePagesForTesting([localPageOlder], [remotePageNewer]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("Default");
    expect(merged[0].headers[0].headerValue).toBe("New");
    // Should preserve the device-specific 'enabled' state of local page
    expect(merged[0].enabled).toBe(true);
  });

  it("should ignore remote page and keep local page when local has a newer lastModified timestamp", () => {
    const merged = mergePagesForTesting([localPageNewer], [remotePageOlder]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("Custom");
    expect(merged[0].headers).toHaveLength(0);
    expect(merged[0].enabled).toBe(true);
  });

  it("should append completely new remote pages to the list and default them to disabled", () => {
    const remoteNewPage: Page = normalizePage({
      id: 1,
      name: "Brand New Sync Page",
      enabled: true,
      keepEnabled: false,
      headers: [],
      lastModified: 4000,
    });

    const merged = mergePagesForTesting([localPageOlder], [remoteNewPage]);
    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe("Default");
    expect(merged[1].name).toBe("Brand New Sync Page");
    expect(merged[1].enabled).toBe(false); // Default disabled
  });
});
