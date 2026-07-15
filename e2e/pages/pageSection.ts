import { Locator, Page } from "@playwright/test";

export class PageSection {
  readonly page: Page;
  readonly newPageButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newPageButton = page.getByTestId("new-page");
  }

  get listItems(): Locator {
    return this.page.getByTestId("page-list-item");
  }

  listItem(name: string): Locator {
    return this.listItems.filter({ hasText: name });
  }

  get activeItem(): Locator {
    return this.page.locator(".page-list-item.active");
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

  async openContextMenu(): Promise<void> {
    await this.activeItem.click({ button: "right" });
    await this.page.getByTestId("page-context-menu").waitFor();
  }

  async duplicateCurrentPage(): Promise<void> {
    await this.openContextMenu();
    await this.page.getByTestId("page-context-duplicate").click();
  }

  async renamePage(name: string): Promise<void> {
    await this.page.getByTestId("page-title").click();
    const input = this.page.getByTestId("page-title-input");
    await input.fill(name);
    await input.press("Enter");
  }

  async deleteCurrentPage(): Promise<void> {
    await this.openContextMenu();
    await this.page.getByTestId("page-context-delete").click();
  }
}
