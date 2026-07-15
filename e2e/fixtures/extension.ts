import { BrowserContext, Page } from "@playwright/test";
import path from "path";

export const pathToExtension = path.join(__dirname, "..", "..", "dist", "chrome");

/**
 * Extracts the dynamic extension ID from the loaded extension's background
 * page or service worker. Chrome assigns a stable ID for the duration of the
 * browser context, so we parse it from the chrome-extension:// URL.
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  // Manifest V2 background page path
  let background = context.backgroundPages()[0];

  // Manifest V3 service worker path
  if (!background) {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent("serviceworker");
    }
    const url = worker.url();
    const id = url.split("/")[2];
    if (!id) {
      throw new Error(`Could not parse extension ID from service worker URL: ${url}`);
    }
    return id;
  }

  const url = background.url();
  const id = url.split("/")[2];
  if (!id) {
    throw new Error(`Could not parse extension ID from background page URL: ${url}`);
  }
  return id;
}

/**
 * Navigates to the popup UI rendered inside a normal tab. The query parameter
 * forces App.tsx to render the popup layout (see isRunningInActionPopup).
 */
export async function gotoPopup(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/app.html?flexheader-popup=1`, {
    waitUntil: "domcontentloaded",
  });
}

/**
 * Clears the extension's local storage from within the extension page.
 * Call this in beforeEach to keep tests independent.
 */
export async function clearExtensionStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
  });
}

/**
 * Waits until the extension's dynamic DNR rules contain a rule that touches
 * the given header name. This is more reliable than a fixed sleep because the
 * background service worker updates rules asynchronously after storage changes.
 */
export async function waitForHeaderRule(page: Page, headerName: string): Promise<void> {
  await page.waitForFunction(
    async (name: string) => {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      return rules.some((rule) => {
        const action = rule.action as
          | { requestHeaders?: Array<{ header: string }>; responseHeaders?: Array<{ header: string }> }
          | undefined;
        const headers = action?.requestHeaders ?? action?.responseHeaders ?? [];
        return headers.some((h) => h.header === name);
      });
    },
    headerName,
    { timeout: 5000 }
  );
}
