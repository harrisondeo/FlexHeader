import { test, expect } from "./baseTest";

const REVIEW_PROMPT_KEY = "reviewPrompt";

const daysAgo = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;
const fourDaysAgo = () => daysAgo(4);

/**
 * Seeds the extension sync storage so the review prompt thinks the user
 * installed several days ago and has never seen or dismissed the prompt.
 */
async function seedOldReviewPromptData(page: import("@playwright/test").Page): Promise<void> {
  await seedReviewPromptData(page, {
    installDate: fourDaysAgo(),
    lastShownDate: 0,
    userReviewed: false,
    dismissed: false,
  });
}

async function seedReviewPromptData(
  page: import("@playwright/test").Page,
  data: { installDate: number; lastShownDate: number; userReviewed: boolean; dismissed: boolean }
): Promise<void> {
  await page.evaluate(async ({ key, data }) => {
    await chrome.storage.sync.set({ [key]: data });
  }, { key: REVIEW_PROMPT_KEY, data });
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

  test("re-shows after the dismiss cooldown has elapsed", async ({ popupPage }) => {
    // Arrange: simulate a dismiss from 20 days ago (past the 14-day cooldown).
    await seedReviewPromptData(popupPage.page, {
      installDate: daysAgo(30),
      lastShownDate: daysAgo(20),
      userReviewed: false,
      dismissed: true,
    });
    await popupPage.page.reload({ waitUntil: "domcontentloaded" });
    await expect(popupPage.pages.listItems.first()).toBeVisible();

    // Assert: the prompt reappears rather than staying hidden forever.
    await expect(popupPage.reviewPrompt.container).toBeVisible();
  });

  test("stays hidden while inside the dismiss cooldown window", async ({ popupPage }) => {
    // Arrange: simulate a dismiss from 2 days ago (still within the 14-day cooldown).
    await seedReviewPromptData(popupPage.page, {
      installDate: daysAgo(30),
      lastShownDate: daysAgo(2),
      userReviewed: false,
      dismissed: true,
    });
    await popupPage.page.reload({ waitUntil: "domcontentloaded" });
    await expect(popupPage.pages.listItems.first()).toBeVisible();

    // Assert: the prompt does not reappear yet.
    await expect(popupPage.reviewPrompt.container).not.toBeVisible();
  });

  test("fast-tracks past the min-install-age gate on the next open once enough headers are added", async ({ popupPage }) => {
    // Arrange: a brand new install (0 days old) would normally never show the prompt.
    await seedReviewPromptData(popupPage.page, {
      installDate: Date.now(),
      lastShownDate: 0,
      userReviewed: false,
      dismissed: false,
    });
    await popupPage.page.reload({ waitUntil: "domcontentloaded" });
    await expect(popupPage.pages.listItems.first()).toBeVisible();
    await expect(popupPage.reviewPrompt.container).not.toBeVisible();

    // Act: add headers until the engagement threshold (3, including the
    // default page's pre-populated header) is reached. The prompt must not
    // interrupt this session - it should only appear on the next popup open.
    await popupPage.headers.addButton.click();
    await popupPage.headers.addButton.click();
    await expect(popupPage.reviewPrompt.container).not.toBeVisible();

    // Assert: reopening the popup now shows the prompt, fast-tracked past
    // the min-install-age gate by the positive-action signal recorded above.
    await popupPage.page.reload({ waitUntil: "domcontentloaded" });
    await expect(popupPage.pages.listItems.first()).toBeVisible();
    await expect(popupPage.reviewPrompt.container).toBeVisible();
  });
});
