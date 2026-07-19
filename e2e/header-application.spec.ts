import { test, expect } from "./baseTest";
import { fetchRequestHeaders, getResponseHeader } from "./fixtures/network";
import { waitForHeaderRule, waitForNoHeaderRule } from "./fixtures/extension";

const RESPONSE_HEADER_URL = (name: string, value = "original") =>
  `/response-header?header=${encodeURIComponent(name)}&value=${encodeURIComponent(value)}`;

test.describe("Header application via declarativeNetRequest", () => {
  test("applies a request header to all requests by default", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Request", "applied");
    await waitForHeaderRule(popupPage.page, "X-E2E-Request");

    const headers = await fetchRequestHeaders(popupPage.page.context(), "/match");
    expect(headers["x-e2e-request"]).toBe("applied");
  });

  test("applies a response header to all responses by default", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Response", "applied", "response");
    await waitForHeaderRule(popupPage.page, "X-E2E-Response");

    const value = await getResponseHeader(
      popupPage.page.context(),
      "/no-response-header",
      "X-E2E-Response"
    );
    expect(value).toBe("applied");
  });

  test("include regex filter restricts request header to matching URLs", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Request", "regex");
    await popupPage.filters.addFilter("include", "regex", "^http://localhost:9876/match$");
    await waitForHeaderRule(popupPage.page, "X-E2E-Request");

    const matching = await fetchRequestHeaders(popupPage.page.context(), "/match");
    expect(matching["x-e2e-request"]).toBe("regex");

    const nonMatching = await fetchRequestHeaders(popupPage.page.context(), "/other");
    expect(nonMatching["x-e2e-request"]).toBeUndefined();
  });

  test("include url filter restricts request header to matching URLs", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Request", "url");
    await popupPage.filters.addFilter("include", "url", "|http://localhost:9876/match");
    await waitForHeaderRule(popupPage.page, "X-E2E-Request");

    const matching = await fetchRequestHeaders(popupPage.page.context(), "/match");
    expect(matching["x-e2e-request"]).toBe("url");

    const nonMatching = await fetchRequestHeaders(popupPage.page.context(), "/other");
    expect(nonMatching["x-e2e-request"]).toBeUndefined();
  });

  test("exclude regex filter removes request header on matching URLs", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Request", "excluded-regex");
    await popupPage.filters.addFilter("exclude", "regex", "^http://localhost:9876/excluded$");
    await waitForHeaderRule(popupPage.page, "X-E2E-Request");

    const excluded = await fetchRequestHeaders(popupPage.page.context(), "/excluded");
    expect(excluded["x-e2e-request"]).toBeUndefined();

    const included = await fetchRequestHeaders(popupPage.page.context(), "/included");
    expect(included["x-e2e-request"]).toBe("excluded-regex");
  });

  test("include regex filter restricts response header override to matching URLs", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Response", "regex", "response");
    await popupPage.filters.addFilter(
      "include",
      "regex",
      "^http://localhost:9876/response-header\\?header=X-E2E-Response.*$"
    );
    await waitForHeaderRule(popupPage.page, "X-E2E-Response");

    const matching = await getResponseHeader(
      popupPage.page.context(),
      RESPONSE_HEADER_URL("X-E2E-Response"),
      "X-E2E-Response"
    );
    expect(matching).toBe("regex");

    const nonMatching = await getResponseHeader(
      popupPage.page.context(),
      RESPONSE_HEADER_URL("X-Other-Response"),
      "X-E2E-Response"
    );
    expect(nonMatching).toBeUndefined();
  });

  test("exclude url filter removes response header on matching URLs", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Response", "excluded-url", "response");
    await popupPage.filters.addFilter(
      "exclude",
      "url",
      "|http://localhost:9876/response-header?header=X-E2E-Response"
    );
    await waitForHeaderRule(popupPage.page, "X-E2E-Response");

    const excluded = await getResponseHeader(
      popupPage.page.context(),
      RESPONSE_HEADER_URL("X-E2E-Response"),
      "X-E2E-Response"
    );
    expect(excluded).toBeUndefined();

    const included = await getResponseHeader(
      popupPage.page.context(),
      RESPONSE_HEADER_URL("X-Other-Response"),
      "X-E2E-Response"
    );
    expect(included).toBe("excluded-url");
  });

  test("disabled include filter is ignored", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Request", "disabled-filter");
    await popupPage.filters.addFilter("include", "regex", "^http://localhost:9876/match$");
    await popupPage.filters.toggleFilter(0);
    await waitForHeaderRule(popupPage.page, "X-E2E-Request");

    const matching = await fetchRequestHeaders(popupPage.page.context(), "/match");
    expect(matching["x-e2e-request"]).toBe("disabled-filter");

    const nonMatching = await fetchRequestHeaders(popupPage.page.context(), "/other");
    expect(nonMatching["x-e2e-request"]).toBe("disabled-filter");
  });

  test("pausing the selected page stops its headers from applying", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Paused", "applied");
    await waitForHeaderRule(popupPage.page, "X-E2E-Paused");

    const beforePause = await fetchRequestHeaders(popupPage.page.context(), "/match");
    expect(beforePause["x-e2e-paused"]).toBe("applied");

    // Pausing must stop the header even though this page is still the
    // selected (currently open) page - that's the whole point of pause as
    // distinct from the "run in background" toggle.
    await popupPage.pages.togglePause();
    await waitForNoHeaderRule(popupPage.page, "X-E2E-Paused");

    const afterPause = await fetchRequestHeaders(popupPage.page.context(), "/match");
    expect(afterPause["x-e2e-paused"]).toBeUndefined();
  });

  test("invalid include filter is ignored", async ({ popupPage }) => {
    await popupPage.pages.addEmptyPage();
    await popupPage.headers.addHeader("X-E2E-Request", "invalid-filter");
    await popupPage.filters.addFilter("include", "url", "ex|ample.com");
    await expect(popupPage.filters.isFilterValid(0)).resolves.toBe(false);
    await waitForHeaderRule(popupPage.page, "X-E2E-Request");

    const headers = await fetchRequestHeaders(popupPage.page.context(), "/match");
    expect(headers["x-e2e-request"]).toBe("invalid-filter");
  });
});
