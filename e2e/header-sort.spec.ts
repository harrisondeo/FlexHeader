import { test, expect } from "./baseTest";

test.describe("Header Sort", () => {
  test("sorts headers by name ascending", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("Zebra", "z-value");
    await popupPage.headers.addHeader("Apple", "a-value");
    await popupPage.headers.addHeader("Mango", "m-value");

    await popupPage.headers.sortBy("headerName", "asc");

    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("Apple");
    await expect(popupPage.headers.getHeaderName(1)).resolves.toBe("Mango");
    await expect(popupPage.headers.getHeaderName(2)).resolves.toBe("Zebra");
  });

  test("sorts headers by name descending", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("Zebra", "z-value");
    await popupPage.headers.addHeader("Apple", "a-value");
    await popupPage.headers.addHeader("Mango", "m-value");

    await popupPage.headers.sortBy("headerName", "desc");

    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("Zebra");
    await expect(popupPage.headers.getHeaderName(1)).resolves.toBe("Mango");
    await expect(popupPage.headers.getHeaderName(2)).resolves.toBe("Apple");
  });

  test("sorts headers by value", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("H1", "gamma");
    await popupPage.headers.addHeader("H2", "alpha");
    await popupPage.headers.addHeader("H3", "beta");

    await popupPage.headers.sortBy("headerValue", "asc");

    await expect(popupPage.headers.getHeaderValue(0)).resolves.toBe("alpha");
    await expect(popupPage.headers.getHeaderValue(1)).resolves.toBe("beta");
    await expect(popupPage.headers.getHeaderValue(2)).resolves.toBe("gamma");
  });

  test("sorts headers by comment", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.showComments();

    await popupPage.headers.addHeader("H1", "v1");
    await popupPage.headers.setHeaderComment(0, "third");
    await popupPage.headers.addHeader("H2", "v2");
    await popupPage.headers.setHeaderComment(1, "first");
    await popupPage.headers.addHeader("H3", "v3");
    await popupPage.headers.setHeaderComment(2, "second");

    await popupPage.headers.sortBy("headerComment", "asc");

    await expect(popupPage.headers.getHeaderComment(0)).resolves.toBe("first");
    await expect(popupPage.headers.getHeaderComment(1)).resolves.toBe("second");
    await expect(popupPage.headers.getHeaderComment(2)).resolves.toBe("third");
  });

  test("sorts headers by enabled ascending (disabled first)", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("Alpha", "a-value");
    await popupPage.headers.addHeader("Bravo", "b-value");
    await popupPage.headers.addHeader("Charlie", "c-value");

    // All headers start enabled by default; disable the first two.
    await popupPage.headers.toggleHeader(0);
    await popupPage.headers.toggleHeader(1);

    await popupPage.headers.sortBy("headerEnabled", "asc");

    await expect(popupPage.headers.isHeaderEnabled(0)).resolves.toBe(false);
    await expect(popupPage.headers.isHeaderEnabled(1)).resolves.toBe(false);
    await expect(popupPage.headers.isHeaderEnabled(2)).resolves.toBe(true);
    await expect(popupPage.headers.getHeaderName(2)).resolves.toBe("Charlie");
  });

  test("sorts headers by enabled descending (enabled first)", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("Alpha", "a-value");
    await popupPage.headers.addHeader("Bravo", "b-value");
    await popupPage.headers.addHeader("Charlie", "c-value");

    await popupPage.headers.toggleHeader(1);

    await popupPage.headers.sortBy("headerEnabled", "desc");

    await expect(popupPage.headers.isHeaderEnabled(0)).resolves.toBe(true);
    await expect(popupPage.headers.isHeaderEnabled(1)).resolves.toBe(true);
    await expect(popupPage.headers.isHeaderEnabled(2)).resolves.toBe(false);
    await expect(popupPage.headers.getHeaderName(2)).resolves.toBe("Bravo");
  });

  test("sort is a one-time operation, not persisted as a setting", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("Zebra", "z-value");
    await popupPage.headers.addHeader("Apple", "a-value");

    await popupPage.headers.sortBy("headerName", "asc");
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("Apple");

    // Adding a new header afterwards should not re-trigger sorting.
    await popupPage.headers.addHeader("Middle", "mid-value");
    await expect(popupPage.headers.getHeaderName(2)).resolves.toBe("Middle");
  });
});
