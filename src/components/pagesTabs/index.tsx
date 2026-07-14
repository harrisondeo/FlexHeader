import { Page } from "../../utils/settings";
import "./index.css";
import PageOptionsDropdown from "../pageOptionsDropdown";
import Button from "../button";

const PagesTabs = ({
  currentPage,
  darkModeEnabled,
  addPage,
  removePage,
  updatePageName,
  updatePageKeepEnabled,
  updatePageShowHeaderComments,
  changePageIndex,
  toggleDarkMode,
}: {
  currentPage: Page;
  darkModeEnabled: boolean;
  addPage: (page?: Page) => void;
  removePage: (id: number, autoSelectPage: boolean) => void;
  updatePageName: (name: string, id: number) => void;
  updatePageKeepEnabled: (id: number, enabled: boolean) => void;
  updatePageShowHeaderComments: (id: number, showHeaderComments: boolean) => void;
  changePageIndex: (id: number, newIndex: number) => void;
  toggleDarkMode: () => Promise<void>;
}) => {
  return (
    <div className="pages-tabs__actions">
      <div className="pages-tabs__actions__buttons">
        <Button
          onClick={() =>
            updatePageKeepEnabled(currentPage.id, !currentPage.keepEnabled)
          }
          color={currentPage.keepEnabled ? "primary" : "secondary"}
          title={
            currentPage.keepEnabled
              ? "Keep this page enabled even when another page is selected"
              : "This page is disabled when another page is selected"
          }
          content={
            <span className="pages-tabs__toggle-button-content">
              <img
                className="pages-tabs__toggle-icon"
                src={`/icons/power-${currentPage.keepEnabled ? "active" : "inactive"}.svg`}
                alt=""
              />
              Background
            </span>
          }
        />
        <Button
          onClick={() =>
            updatePageShowHeaderComments(
              currentPage.id,
              !currentPage.showHeaderComments
            )
          }
          color={currentPage.showHeaderComments ? "primary" : "secondary"}
          title={
            currentPage.showHeaderComments
              ? "Show the header comments"
              : "Hide the header comments"
          }
          content={
            <span className="pages-tabs__toggle-button-content">
              <img
                className="pages-tabs__toggle-icon"
                src={`/icons/comment-${currentPage.showHeaderComments ? "active" : "inactive"}.svg`}
                alt=""
              />
              Comments
            </span>
          }
        />
      </div>
      <div className="pages-tabs__actions__buttons">
        <Button
          onClick={() => changePageIndex(currentPage.id, currentPage.id - 1)}
          content={"<"}
          testId="page-move-left"
        />
        <Button
          onClick={() => changePageIndex(currentPage.id, currentPage.id + 1)}
          content={">"}
          testId="page-move-right"
        />
        <Button
          onClick={() => addPage(currentPage)}
          content={<img src="/icons/duplicate.svg" alt="Duplicate" />}
          testId="duplicate-page"
        />
        <PageOptionsDropdown
          page={currentPage}
          darkModeEnabled={darkModeEnabled}
          removePage={() => removePage(currentPage.id, true)}
          updatePageName={(name: string) =>
            updatePageName(name, currentPage.id)
          }
          toggleDarkMode={toggleDarkMode}
        />
      </div>
    </div>
  );
};

export default PagesTabs;
