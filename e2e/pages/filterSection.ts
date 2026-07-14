import { Locator, Page } from "@playwright/test";

export class FilterSection {
  readonly page: Page;
  readonly addButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByTestId("add-filter");
  }

  get rows(): Locator {
    return this.page.getByTestId("filter-row");
  }

  row(index: number): Locator {
    return this.rows.nth(index);
  }

  async addFilter(
    type: "include" | "exclude",
    mode: "regex" | "url",
    value: string
  ): Promise<void> {
    await this.addButton.click();
    const newRow = this.rows.last();
    await newRow.getByTestId("filter-type").selectOption(type);
    await newRow.getByTestId("filter-mode").selectOption(mode);
    await newRow.getByTestId("filter-value").fill(value);
  }

  async removeFilter(index: number): Promise<void> {
    await this.row(index).getByTestId("filter-remove").click();
  }

  async toggleFilter(index: number): Promise<void> {
    await this.row(index).getByTestId("filter-enabled").click();
  }

  async setFilterValue(index: number, value: string): Promise<void> {
    await this.row(index).getByTestId("filter-value").fill(value);
  }

  async getFilterValue(index: number): Promise<string> {
    return this.row(index).getByTestId("filter-value").inputValue();
  }

  async getFilterType(index: number): Promise<string> {
    return this.row(index).getByTestId("filter-type").inputValue();
  }

  async getFilterMode(index: number): Promise<string> {
    return this.row(index).getByTestId("filter-mode").inputValue();
  }

  async isFilterEnabled(index: number): Promise<boolean> {
    return this.row(index).getByTestId("filter-enabled").isChecked();
  }

  async isFilterValid(index: number): Promise<boolean> {
    const valueInput = this.row(index).getByTestId("filter-value");
    const background = await valueInput.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    // Invalid filters are styled with a red background.
    return background !== "rgb(255, 0, 0)";
  }

  async count(): Promise<number> {
    return this.rows.count();
  }
}
