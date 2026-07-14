import { test, expect } from "./baseTest";

test.describe("Filter CRUD", () => {
  test("adds an include regex filter", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Test", "value");
    await popupPage.filters.addFilter("include", "regex", "^https://example\\.com/.*");

    await expect(popupPage.filters.rows).toHaveCount(1);
    await expect(popupPage.filters.getFilterType(0)).resolves.toBe("include");
    await expect(popupPage.filters.getFilterMode(0)).resolves.toBe("regex");
    await expect(popupPage.filters.getFilterValue(0)).resolves.toBe("^https://example\\.com/.*");
    await expect(popupPage.filters.isFilterValid(0)).resolves.toBe(true);
  });

  test("adds an exclude filter", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Test", "value");
    await popupPage.filters.addFilter("exclude", "regex", "https://exclude\\.com/.*");

    await expect(popupPage.filters.getFilterType(0)).resolves.toBe("exclude");
    await expect(popupPage.filters.getFilterValue(0)).resolves.toBe("https://exclude\\.com/.*");
  });

  test("marks invalid url filter with red background", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Test", "value");
    await popupPage.filters.addFilter("include", "url", "ex|ample.com");

    await expect(popupPage.filters.isFilterValid(0)).resolves.toBe(false);
  });

  test("removes a filter", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Test", "value");
    await popupPage.filters.addFilter("include", "regex", "a");
    await popupPage.filters.addFilter("include", "regex", "b");

    await expect(popupPage.filters.rows).toHaveCount(2);

    await popupPage.filters.removeFilter(0);

    await expect(popupPage.filters.rows).toHaveCount(1);
    await expect(popupPage.filters.getFilterValue(0)).resolves.toBe("b");
  });
});
