import { Locator, Page, Download } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Page as FlexHeaderPage } from "../../src/utils/settings";

export class ExportImportSection {
  readonly page: Page;
  readonly exportButton: Locator;
  readonly importButton: Locator;
  readonly exportPopup: Locator;
  readonly importPopup: Locator;

  constructor(page: Page) {
    this.page = page;
    this.exportButton = page.getByTestId("export-button");
    this.importButton = page.getByTestId("import-button");
    this.exportPopup = page.getByTestId("export-popup");
    this.importPopup = page.getByTestId("import-popup");
  }

  get exportPageItems(): Locator {
    return this.page.getByTestId("export-popup__page");
  }

  get exportPageCheckboxes(): Locator {
    return this.page.getByTestId("export-popup__page-checkbox");
  }

  get exportPopupExportButton(): Locator {
    return this.page.getByTestId("export-popup__export-button");
  }

  get importFileInput(): Locator {
    return this.page.getByTestId("import-file-input");
  }

  async openExportPopup(): Promise<void> {
    await this.exportButton.click();
    await this.exportPopupExportButton.waitFor({ state: "visible" });
  }

  async openImportPopup(): Promise<void> {
    await this.importButton.click();
    await this.importPopup.waitFor({ state: "visible" });
  }

  /**
   * Selects pages for export by clicking their checkboxes.
   * If no indices are provided, all pages are selected.
   */
  async selectExportPages(indices: number[] = []): Promise<void> {
    const checkboxes = this.exportPageCheckboxes;
    const count = await checkboxes.count();
    const targetIndices = indices.length > 0 ? indices : Array.from({ length: count }, (_, i) => i);

    for (const index of targetIndices) {
      const checkbox = checkboxes.nth(index);
      if (!(await checkbox.isChecked())) {
        await checkbox.click();
      }
    }
  }

  /**
   * Exports the currently selected pages and returns the parsed JSON contents
   * of the downloaded file.
   */
  async exportSelectedPages(): Promise<FlexHeaderPage[]> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.exportPopupExportButton.click(),
    ]);

    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error("Export download did not produce a file path.");
    }

    const raw = fs.readFileSync(downloadPath, "utf-8");
    return JSON.parse(raw) as FlexHeaderPage[];
  }

  /**
   * Writes the provided pages to a temporary JSON file and imports it via the
   * import popup file input.
   */
  async importPages(pages: FlexHeaderPage[]): Promise<void> {
    const tmpFile = path.join(os.tmpdir(), `flexheader-import-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(pages, null, 2), "utf-8");
    await this.importFileInput.setInputFiles(tmpFile);
    // The browser reads the file during setInputFiles; leaving it in tmp lets
    // subsequent assertions observe the import result before cleanup.
  }

  /**
   * Writes arbitrary content to a temporary JSON file and imports it.
   */
  async importRaw(content: unknown): Promise<void> {
    const tmpFile = path.join(os.tmpdir(), `flexheader-import-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(content), "utf-8");
    await this.importFileInput.setInputFiles(tmpFile);
  }
}
