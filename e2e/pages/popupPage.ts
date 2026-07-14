import { Page } from "@playwright/test";
import { HeaderSection } from "./headerSection";
import { FilterSection } from "./filterSection";
import { PageSection } from "./pageSection";
import { ExportImportSection } from "./exportImportSection";

export class PopupPage {
  readonly page: Page;
  readonly headers: HeaderSection;
  readonly filters: FilterSection;
  readonly pages: PageSection;
  readonly exportImport: ExportImportSection;

  constructor(page: Page) {
    this.page = page;
    this.headers = new HeaderSection(page);
    this.filters = new FilterSection(page);
    this.pages = new PageSection(page);
    this.exportImport = new ExportImportSection(page);
  }
}
