import { defineConfig, devices } from "@playwright/test";
import path from "path";

const pathToExtension = path.join(__dirname, "build");

/**
 * Playwright end-to-end configuration for the FlexHeader Chrome extension.
 *
 * Tests load the real extension from ./build and navigate to the popup UI
 * via chrome-extension://<id>/index.html?flexheader-popup=1. Chrome extension
 * loading requires a headed browser, so headless is disabled here.
 *
 * The extension is built before tests via the `pretest:e2e` npm script, which
 * runs `bun run build:chrome`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        launchOptions: {
          args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
          ],
        },
      },
    },
  ],
});
