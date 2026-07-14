import { Locator, Page } from "@playwright/test";

export class HeaderSection {
  readonly page: Page;
  readonly addButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByTestId("add-header");
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
}
