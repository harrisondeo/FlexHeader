import { test, expect } from "./baseTest";

const REVIEW_PROMPT_KEY = "reviewPrompt";

const fourDaysAgo = () => Date.now() - 4 * 24 * 60 * 60 * 1000;

/**
 * Seeds the extension sync storage so the review prompt thinks the user
 * installed several days ago and has never seen or dismissed the prompt.
 */
async function seedOldReviewPromptData(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(async ({ key, installDate }: { key: string; installDate: number }) => {
    await chrome.storage.sync.set({
      [key]: {
        installDate,
        lastShownDate: 0,
        userReviewed: false,
        dismissed: false,
      },
    });
  }, { key: REVIEW_PROMPT_KEY, installDate: fourDaysAgo() });
}

test.describe("Review Prompt", () => {
  test("shows, hides on dismiss, and does not show again in the same session", async ({ popupPage }) => {
    // Arrange: simulate an install from 4 days ago with no prior prompt.
    await seedOldReviewPromptData(popupPage.page);
    await popupPage.page.reload({ waitUntil: "domcontentloaded" });
    await expect(popupPage.pages.listItems.first()).toBeVisible();

    // Assert: the review prompt is visible.
    await expect(popupPage.reviewPrompt.container).toBeVisible();
    await expect(popupPage.reviewPrompt.container).toContainText("Enjoying FlexHeaders?");

    // Act: dismiss the prompt.
    await popupPage.reviewPrompt.dismiss();

    // Assert: the prompt is hidden immediately after dismissing.
    await expect(popupPage.reviewPrompt.container).not.toBeVisible();

    // Act: reload the popup again.
    await popupPage.page.reload({ waitUntil: "domcontentloaded" });
    await expect(popupPage.pages.listItems.first()).toBeVisible();

    // Assert: the prompt does not reappear after being dismissed.
    await expect(popupPage.reviewPrompt.container).not.toBeVisible();
  });
});
