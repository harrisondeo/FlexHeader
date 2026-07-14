import { test, expect } from "./baseTest";

test.describe("Header CRUD", () => {
  test("default page starts with the X-Frame-Options header", async ({ popupPage }) => {
    await expect(popupPage.headers.rows).toHaveCount(1);
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Frame-Options");
    await expect(popupPage.headers.getHeaderValue(0)).resolves.toBe(
      "ALLOW-FROM https://www.youtube.com/"
    );
  });

  test("adds a request header", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();

    await popupPage.headers.addHeader("X-Test", "test-value");

    await expect(popupPage.headers.rows).toHaveCount(1);
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Test");
    await expect(popupPage.headers.getHeaderValue(0)).resolves.toBe("test-value");
    await expect(popupPage.headers.getHeaderType(0)).resolves.toBe("request");
  });

  test("adds a response header", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();

    await popupPage.headers.addHeader("X-Test", "value", "response");

    await expect(popupPage.headers.getHeaderType(0)).resolves.toBe("response");
  });

  test("edits header name and value", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Old", "old-value");

    await popupPage.headers.setHeaderName(0, "X-New");
    await popupPage.headers.setHeaderValue(0, "new-value");

    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-New");
    await expect(popupPage.headers.getHeaderValue(0)).resolves.toBe("new-value");
  });

  test("toggles header enabled state", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Toggle", "value");

    await expect(popupPage.headers.isHeaderEnabled(0)).resolves.toBe(true);

    await popupPage.headers.toggleHeader(0);

    await expect(popupPage.headers.isHeaderEnabled(0)).resolves.toBe(false);
  });

  test("removes a header", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-Keep", "keep");
    await popupPage.headers.addHeader("X-Remove", "remove");

    await expect(popupPage.headers.rows).toHaveCount(2);

    await popupPage.headers.removeHeader(0);

    await expect(popupPage.headers.rows).toHaveCount(1);
    await expect(popupPage.headers.getHeaderName(0)).resolves.toBe("X-Remove");
  });
});
