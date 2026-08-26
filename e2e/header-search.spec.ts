import { test, expect } from "./baseTest";

test.describe("Header search", () => {
  test("opens the search field in place of the page title", async ({ popupPage }) => {
    const title = popupPage.page.getByTestId("page-title");
    await expect(title).toBeVisible();

    await popupPage.headers.openSearch();

    await expect(popupPage.headers.searchInput).toBeVisible();
    await expect(popupPage.headers.searchInput).toBeFocused();
    await expect(title).not.toBeVisible();
  });

  test("closes via the toggle button and restores the title", async ({ popupPage }) => {
    await popupPage.headers.openSearch();
    await popupPage.headers.searchFor("anything");

    await popupPage.headers.searchButton.click();

    await expect(popupPage.headers.searchInput).not.toBeVisible();
    await expect(popupPage.page.getByTestId("page-title")).toBeVisible();
  });

  test("closes with Escape and clears the filter", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Alpha", "one");
    await popupPage.headers.addHeader("X-Beta", "two");

    await popupPage.headers.openSearch();
    await popupPage.headers.searchFor("alpha");
    await expect(popupPage.headers.rows).toHaveCount(1);

    await popupPage.headers.closeSearchWithEscape();

    await expect(popupPage.headers.searchInput).not.toBeVisible();
    await expect(popupPage.headers.rows).toHaveCount(2);
  });

  test("filters headers by name and value", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Alpha", "one");
    await popupPage.headers.addHeader("X-Beta", "two");
    await popupPage.headers.addHeader("X-Gamma", "three-two");

    await popupPage.headers.openSearch();
    await popupPage.headers.searchFor("beta");

    await expect(popupPage.headers.rows).toHaveCount(1);
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Beta");

    await popupPage.headers.searchFor("three-two");

    await expect(popupPage.headers.rows).toHaveCount(1);
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Gamma");
  });

  test("shows a message when no headers match", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Alpha", "one");

    await popupPage.headers.openSearch();
    await popupPage.headers.searchFor("no-such-header");

    await expect(popupPage.headers.rows).toHaveCount(0);
    await expect(popupPage.page.getByTestId("headers-no-search-match")).toBeVisible();
  });

  test("filters headers by comment", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.showComments();
    await popupPage.headers.addHeader("X-Alpha", "one");
    await popupPage.headers.addHeader("X-Beta", "two");
    await popupPage.headers.setHeaderComment(0, "Use for checkout API");
    await popupPage.headers.setHeaderComment(1, "Use for catalog API");

    await popupPage.headers.openSearch();
    await popupPage.headers.searchFor("checkout");

    await expect(popupPage.headers.rows).toHaveCount(1);
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Alpha");
  });

  test("matches regardless of query or header case", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Status", "active");

    await popupPage.headers.openSearch();

    for (const query of ["at", "At", "AT", "aT"]) {
      await popupPage.headers.searchFor(query);
      await expect(popupPage.headers.rows).toHaveCount(1);
      await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Status");
    }
  });
});
