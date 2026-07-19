import { Locator, Page } from "@playwright/test";

export class HeaderSection {
  readonly page: Page;
  readonly addButton: Locator;
  readonly toggleCommentsButton: Locator;
  readonly sortButton: Locator;
  readonly sortDropdown: Locator;
  readonly sortFieldSelect: Locator;
  readonly sortDirectionSelect: Locator;
  readonly sortApplyButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByTestId("add-header");
    this.toggleCommentsButton = page.getByTestId("toggle-header-comments");
    this.sortButton = page.getByTestId("sort-headers-button");
    this.sortDropdown = page.getByTestId("sort-headers-dropdown");
    this.sortFieldSelect = page.getByTestId("sort-headers-field");
    this.sortDirectionSelect = page.getByTestId("sort-headers-direction");
    this.sortApplyButton = page.getByTestId("sort-headers-apply");
  }

  get rows(): Locator {
    return this.page.getByTestId("header-row");
  }

  row(index: number): Locator {
    return this.rows.nth(index);
  }

  async addHeader(name: string, value: string, type: "request" | "response" = "request"): Promise<void> {
    await this.addButton.click();
    const newRow = this.rows.last();
    await newRow.getByTestId("header-name").fill(name);
    await newRow.getByTestId("header-value").fill(value);
    if (type === "response") {
      await newRow.getByTestId("header-type").selectOption("response");
    }
  }

  async removeHeader(index: number): Promise<void> {
    await this.row(index).getByTestId("header-remove").click();
  }

  async toggleHeader(index: number): Promise<void> {
    await this.row(index).getByTestId("header-enabled").click();
  }

  async setHeaderName(index: number, name: string): Promise<void> {
    await this.row(index).getByTestId("header-name").fill(name);
  }

  async setHeaderValue(index: number, value: string): Promise<void> {
    await this.row(index).getByTestId("header-value").fill(value);
  }

  async getHeaderName(index: number): Promise<string> {
    return this.row(index).getByTestId("header-name").inputValue();
  }

  async getHeaderValue(index: number): Promise<string> {
    return this.row(index).getByTestId("header-value").inputValue();
  }

  async getHeaderType(index: number): Promise<string> {
    return this.row(index).getByTestId("header-type").inputValue();
  }

  async isHeaderEnabled(index: number): Promise<boolean> {
    return this.row(index).getByTestId("header-enabled").isChecked();
  }

  async count(): Promise<number> {
    return this.rows.count();
  }

  async setHeaderComment(index: number, comment: string): Promise<void> {
    await this.row(index).getByTestId("header-comment").fill(comment);
  }

  async getHeaderComment(index: number): Promise<string> {
    return this.row(index).getByTestId("header-comment").inputValue();
  }

  async showComments(): Promise<void> {
    const state = await this.toggleCommentsButton.getAttribute("title");
    if (state === "Show the header comments") {
      await this.toggleCommentsButton.click();
    }
  }

  /**
   * Opens the sort popup, selects the given field/direction, and applies it.
   * The popup closes itself on apply.
   */
  async sortBy(
    field: "headerName" | "headerValue" | "headerComment",
    direction: "asc" | "desc" = "asc"
  ): Promise<void> {
    await this.sortButton.click();
    await this.sortDropdown.waitFor({ state: "visible" });
    await this.sortFieldSelect.selectOption(field);
    await this.sortDirectionSelect.selectOption(direction);
    await this.sortApplyButton.click();
    await this.sortDropdown.waitFor({ state: "hidden" });
  }

  async getAllHeaderNames(): Promise<string[]> {
    return this.rows.evaluateAll((rows) =>
      rows.map(
        (row) =>
          (row.querySelector('[data-testid="header-name"]') as HTMLInputElement)
            ?.value ?? ""
      )
    );
  }
}
