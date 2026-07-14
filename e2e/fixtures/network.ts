import { BrowserContext } from "@playwright/test";

export const TEST_SERVER_URL =
  process.env.E2E_TEST_SERVER_URL || "http://localhost:9876";

/**
 * Opens a fresh tab in the same browser context, navigates to the given test
 * server path, and returns the request headers that the server received.
 *
 * This lets us assert that FlexHeaders actually applied request headers via
 * declarativeNetRequest.
 */
export async function fetchRequestHeaders(
  context: BrowserContext,
  path: string
): Promise<Record<string, string | string[]>> {
  const page = await context.newPage();
  try {
    const response = await page.goto(`${TEST_SERVER_URL}${path}`, {
      waitUntil: "load",
    });
    if (!response) {
      throw new Error(`No response received for ${path}`);
    }
    const body = await response.text();
    return JSON.parse(body);
  } finally {
    await page.close();
  }
}

/**
 * Opens a fresh tab in the same browser context, navigates to the given test
 * server path, and returns the value of the specified response header.
 *
 * This lets us assert that FlexHeaders actually applied/removed response
 * headers via declarativeNetRequest.
 */
export async function getResponseHeader(
  context: BrowserContext,
  path: string,
  headerName: string
): Promise<string | undefined> {
  const page = await context.newPage();
  try {
    const response = await page.goto(`${TEST_SERVER_URL}${path}`, {
      waitUntil: "load",
    });
    if (!response) {
      throw new Error(`No response received for ${path}`);
    }
    return response.headers()[headerName.toLowerCase()];
  } finally {
    await page.close();
  }
}
