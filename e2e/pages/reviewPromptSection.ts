import { Locator, Page } from "@playwright/test";

export class ReviewPromptSection {
  readonly page: Page;
  readonly container: Locator;
  readonly dismissButton: Locator;
  readonly reviewButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator(".review-prompt");
    this.dismissButton = page.getByRole("button", { name: "Dismiss" });
    this.reviewButton = page.getByRole("button", { name: "Review" });
  }

  async dismiss(): Promise<void> {
    await this.dismissButton.click();
  }

  async review(): Promise<void> {
    await this.reviewButton.click();
  }
}
