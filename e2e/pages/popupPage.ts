import { Page } from "@playwright/test";
import { HeaderSection } from "./headerSection";
import { FilterSection } from "./filterSection";
import { PageSection } from "./pageSection";

export class PopupPage {
  readonly page: Page;
  readonly headers: HeaderSection;
  readonly filters: FilterSection;
  readonly pages: PageSection;

  constructor(page: Page) {
    this.page = page;
    this.headers = new HeaderSection(page);
    this.filters = new FilterSection(page);
    this.pages = new PageSection(page);
  }
}
