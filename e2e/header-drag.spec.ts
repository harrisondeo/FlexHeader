import { test, expect } from "./baseTest";

test.describe("Header Drag and Drop", () => {
  test("drags the first header to the end of the list", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("Alpha", "a-value");
    await popupPage.headers.addHeader("Bravo", "b-value");
    await popupPage.headers.addHeader("Charlie", "c-value");

    await popupPage.headers.dragHeaderTo(0, 2);

    // onDragEnd (and the resulting save) settle asynchronously after the
    // drop, so this must poll rather than assert once immediately.
    await expect
      .poll(() => popupPage.headers.getAllHeaderNames())
      .toEqual(["Bravo", "Charlie", "Alpha"]);
  });

  test("drags the last header to the start of the list", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("Alpha", "a-value");
    await popupPage.headers.addHeader("Bravo", "b-value");
    await popupPage.headers.addHeader("Charlie", "c-value");

    await popupPage.headers.dragHeaderTo(2, 0);

    await expect
      .poll(() => popupPage.headers.getAllHeaderNames())
      .toEqual(["Charlie", "Alpha", "Bravo"]);
  });

  test("swaps two adjacent headers", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("Alpha", "a-value");
    await popupPage.headers.addHeader("Bravo", "b-value");

    await popupPage.headers.dragHeaderTo(0, 1);

    await expect
      .poll(() => popupPage.headers.getAllHeaderNames())
      .toEqual(["Bravo", "Alpha"]);
  });

  test("preserves each header's value and comment after reordering", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.showComments();
    await popupPage.headers.addHeader("Alpha", "a-value");
    await popupPage.headers.setHeaderComment(0, "first comment");
    await popupPage.headers.addHeader("Bravo", "b-value");
    await popupPage.headers.setHeaderComment(1, "second comment");

    await popupPage.headers.dragHeaderTo(0, 1);

    await expect
      .poll(() => popupPage.headers.getAllHeaderNames())
      .toEqual(["Bravo", "Alpha"]);

    await expect(popupPage.headers.getHeaderValue(0)).resolves.toBe("b-value");
    await expect(popupPage.headers.getHeaderComment(0)).resolves.toBe("second comment");
    await expect(popupPage.headers.getHeaderValue(1)).resolves.toBe("a-value");
    await expect(popupPage.headers.getHeaderComment(1)).resolves.toBe("first comment");
  });

  // Not a reload-based persistence test: reloading the popup has a separate,
  // pre-existing flaky data-loss issue unrelated to drag-and-drop (tracked
  // separately). Checking chrome.storage.local directly instead still
  // catches the regression that matters here - a drop that reorders the UI
  // but never actually calls saveHeaders/persists anything.
  test("actually persists the new order to storage, not just the UI", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("Alpha", "a-value");
    await popupPage.headers.addHeader("Bravo", "b-value");
    await popupPage.headers.addHeader("Charlie", "c-value");

    await popupPage.headers.dragHeaderTo(0, 2);

    const getStoredHeaderNames = () =>
      popupPage.page.evaluate(async () => {
        const all = await chrome.storage.local.get(null);
        const pageKey = Object.keys(all).find(
          (key) =>
            key.startsWith("page_") &&
            all[key]?.headers?.some((h: { headerName: string }) => h.headerName === "Alpha")
        );
        return pageKey
          ? all[pageKey].headers.map((h: { headerName: string }) => h.headerName)
          : null;
      });

    await expect
      .poll(getStoredHeaderNames)
      .toEqual(["Bravo", "Charlie", "Alpha"]);
  });
});
