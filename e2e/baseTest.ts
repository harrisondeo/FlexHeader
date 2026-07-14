import { test as base, chromium, type BrowserContext, expect } from "@playwright/test";
import path from "path";
import { PopupPage } from "./pages/popupPage";
import { clearExtensionStorage, getExtensionId, gotoPopup } from "./fixtures/extension";

const pathToExtension = path.join(__dirname, "..", "build");

/**
 * Shared test fixture for FlexHeader E2E tests.
 *
 * Each test gets a fresh Chromium browser context with the built extension
 * loaded. The popupPage fixture navigates to the popup UI and clears storage
 * so every test starts from a clean default state.
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  popupPage: PopupPage;
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    const id = await getExtensionId(context);
    await use(id);
  },
  popupPage: async ({ page, extensionId }, use) => {
    await gotoPopup(page, extensionId);
    await clearExtensionStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const popupPage = new PopupPage(page);
    // Wait for the UI to mount and the default page to render.
    await expect(popupPage.pages.listItems.first()).toBeVisible();
    await use(popupPage);
  },
});

export { expect } from "@playwright/test";
