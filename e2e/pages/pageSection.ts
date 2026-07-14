import { Locator, Page } from "@playwright/test";

export class PageSection {
  readonly page: Page;
  readonly newPageButton: Locator;
  readonly duplicatePageButton: Locator;
  readonly pageOptionsMenuButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newPageButton = page.getByTestId("new-page");
    this.duplicatePageButton = page.getByTestId("duplicate-page");
    this.pageOptionsMenuButton = page.getByTestId("page-options-menu");
  }

  get listItems(): Locator {
    return this.page.getByTestId("page-list-item");
  }

  listItem(name: string): Locator {
    return this.listItems.filter({ hasText: name });
  }

  async selectPage(name: string): Promise<void> {
    await this.listItem(name).click();
  }

  async getPageNames(): Promise<string[]> {
    return this.listItems.evaluateAll((items) =>
      items.map((item) => item.querySelector("h3")?.textContent ?? "")
    );
  }

  async getActivePageName(): Promise<string> {
    return this.page.locator(".page-list-item.active h3").textContent();
  }

  async addNewPage(): Promise<void> {
    await this.newPageButton.click();
  }

  /**
   * Creates a fresh, empty page and selects it.
   * The default page ships with one header, so tests that want predictable
   * counts should start from a new page created via this helper.
   */
  async addEmptyPage(): Promise<void> {
    await this.addNewPage();
  }

  async duplicateCurrentPage(): Promise<void> {
    await this.duplicatePageButton.click();
  }

  async openOptions(): Promise<void> {
    await this.pageOptionsMenuButton.click();
  }

  async renamePage(name: string): Promise<void> {
    await this.openOptions();
    await this.page.getByTestId("page-name-input").fill(name);
    // Close the dropdown by pressing Escape so it does not obscure other UI.
    await this.page.keyboard.press("Escape");
  }

  async deleteCurrentPage(): Promise<void> {
    await this.openOptions();
    await this.page.getByTestId("page-delete").click();
  }
}
