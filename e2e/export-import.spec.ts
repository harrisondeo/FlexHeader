import { test, expect } from "./baseTest";
import { Page as FlexHeaderPage } from "../src/utils/settings";
import { clearExtensionStorage, gotoPopup } from "./fixtures/extension";

const buildSamplePage = (overrides: Partial<FlexHeaderPage> = {}): FlexHeaderPage => ({
  id: 0,
  name: "Imported Page",
  enabled: true,
  keepEnabled: false,
  showHeaderComments: true,
  filters: [
    {
      id: "1",
      enabled: true,
      valid: true,
      type: "include",
      mode: "regex",
      value: ".*example\\.com.*",
    },
  ],
  headers: [
    {
      id: "1",
      headerName: "X-Imported",
      headerValue: "imported-value",
      headerComment: "",
      headerEnabled: true,
      headerType: "request",
    },
  ],
  ...overrides,
});

test.describe("Export / Import", () => {
  test("exports the default page", async ({ popupPage }) => {
    await popupPage.exportImport.openExportPopup();
    await popupPage.exportImport.selectExportPages();

    const exported = await popupPage.exportImport.exportSelectedPages();

    expect(exported).toHaveLength(1);
    expect(exported[0].name).toBe("Default");
    expect(exported[0].headers).toHaveLength(1);
    expect(exported[0].headers[0].headerName).toBe("X-Frame-Options");
  });

  test("exports multiple pages with headers and filters", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.pages.renamePage("Custom Page");
    await popupPage.headers.addHeader("X-Custom", "custom-value");
    await popupPage.filters.addFilter("exclude", "url", "|http*bad*");

    await popupPage.exportImport.openExportPopup();
    await popupPage.exportImport.selectExportPages();

    const exported = await popupPage.exportImport.exportSelectedPages();

    const names = exported.map((page) => page.name);
    expect(names).toContain("Default");
    expect(names).toContain("Custom Page");

    const customPage = exported.find((page) => page.name === "Custom Page");
    expect(customPage?.headers).toHaveLength(1);
    expect(customPage?.headers[0].headerName).toBe("X-Custom");
    expect(customPage?.filters).toHaveLength(1);
    expect(customPage?.filters[0].type).toBe("exclude");
  });

  test("imports pages from a JSON file", async ({ popupPage }) => {
    const pageToImport = buildSamplePage();

    await popupPage.exportImport.openImportPopup();
    await popupPage.exportImport.importPages([pageToImport]);

    await expect(popupPage.pages.listItem("Imported Page")).toBeVisible();
    await popupPage.pages.selectPage("Imported Page");

    await expect(popupPage.headers.rows).toHaveCount(1);
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Imported");
    await expect(popupPage.headers.getHeaderValue(0)).resolves.toBe("imported-value");
    await expect(popupPage.filters.rows).toHaveCount(1);
    await expect(popupPage.filters.getFilterType(0)).resolves.toBe("include");
    await expect(popupPage.filters.getFilterMode(0)).resolves.toBe("regex");
  });

  test("import appends pages without removing existing pages", async ({ popupPage }) => {
    const initialPageNames = await popupPage.pages.getPageNames();
    expect(initialPageNames).toContain("Default");

    await popupPage.exportImport.openImportPopup();
    await popupPage.exportImport.importPages([buildSamplePage({ name: "Extra Page" })]);

    const finalPageNames = await popupPage.pages.getPageNames();
    expect(finalPageNames).toContain("Default");
    expect(finalPageNames).toContain("Extra Page");
  });

  test("round-trips a custom page through export and import", async ({
    popupPage,
    page,
    extensionId,
  }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.pages.renamePage("Round Trip");
    await popupPage.headers.addHeader("X-Round", "trip-value", "response");
    await popupPage.filters.addFilter("include", "regex", ".*flexheader\\.test.*");

    await popupPage.exportImport.openExportPopup();
    await popupPage.exportImport.selectExportPages([1]);
    const exported = await popupPage.exportImport.exportSelectedPages();

    expect(exported).toHaveLength(1);
    expect(exported[0].name).toBe("Round Trip");
    expect(exported[0].headers).toHaveLength(1);

    // Wait for any pending React state updates and asynchronous storage saves to settle
    await page.waitForTimeout(300);
    await clearExtensionStorage(page);
    await gotoPopup(page, extensionId);
    await expect(popupPage.pages.listItems.first()).toBeVisible();

    const initialNames = await popupPage.pages.getPageNames();
    expect(initialNames).toContain("Default");

    await popupPage.exportImport.openImportPopup();
    await popupPage.exportImport.importPages(exported);

    await expect(popupPage.exportImport.importPopup).toBeHidden();
    await expect(popupPage.pages.listItem("Round Trip")).toBeVisible();
    await popupPage.pages.selectPage("Round Trip");
    await expect(popupPage.pages.getActivePageName()).resolves.toBe("Round Trip");

    await expect(popupPage.headers.rows).toHaveCount(1);
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Round");
    await expect(popupPage.headers.getHeaderValue(0)).resolves.toBe("trip-value");
    await expect(popupPage.headers.getHeaderType(0)).resolves.toBe("response");
    await expect(popupPage.filters.getFilterMode(0)).resolves.toBe("regex");
  });

  test("shows an error when importing an invalid JSON file", async ({ popupPage }) => {
    await popupPage.exportImport.openImportPopup();
    await popupPage.exportImport.importRaw([
      {
        id: "not-a-number",
        name: "",
        headers: "wrong-type",
      },
    ]);

    await expect(
      popupPage.page.locator(".drag-drop-file__status--error")
    ).toBeVisible();
    await expect(
      popupPage.page.locator(".drag-drop-file__status--error")
    ).toContainText("Invalid settings file");
  });
});
