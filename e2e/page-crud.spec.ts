import { test, expect } from "./baseTest";

test.describe("Page CRUD", () => {
  test("adds a new page and selects it", async ({ popupPage }) => {
    await popupPage.pages.addNewPage();

    const names = await popupPage.pages.getPageNames();
    expect(names).toHaveLength(2);
    expect(names[1]).toBe("New Page");

    await expect(popupPage.pages.getActivePageName()).resolves.toBe("New Page");
    // A new page has no headers by default.
    await expect(popupPage.headers.rows).toHaveCount(0);
  });

  test("duplicates a page with its headers", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Copied", "copied-value");
    await popupPage.pages.duplicateCurrentPage();

    await expect(popupPage.pages.getActivePageName()).resolves.toContain("New Page");
    await expect(popupPage.headers.rows).toHaveCount(1);
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Copied");
  });

  test("renames the current page", async ({ popupPage }) => {
    await popupPage.pages.renamePage("Renamed Default");

    await expect(popupPage.pages.getActivePageName()).resolves.toBe("Renamed Default");
  });

  test("deletes a page and falls back to another page", async ({ popupPage }) => {
    await popupPage.pages.addNewPage();
    await popupPage.pages.deleteCurrentPage();

    await expect(popupPage.pages.listItems).toHaveCount(1);
    await expect(popupPage.pages.getActivePageName()).resolves.toBe("Default");
  });
});
