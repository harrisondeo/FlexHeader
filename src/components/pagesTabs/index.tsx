import { Page } from "../../utils/settings";
import "./index.css";
import PageOptionsDropdown from "../pageOptionsDropdown";
import Button from "../button";
import { AlertContextType } from "../../context/alertContext";

const PagesTabs = ({
  currentPage,
  pages,
  darkModeEnabled,
  addPage,
  removePage,
  updatePage,
  changePageIndex,
  toggleDarkMode,
  setAlert,
}: {
  currentPage: Page;
  pages: Page[];
  darkModeEnabled: boolean;
  addPage: (page?: Page) => void;
  removePage: (id: number, autoSelectPage: boolean) => void;
  updatePage: (page: Page) => void;
  changePageIndex: (id: number, newIndex: number) => void;
  toggleDarkMode: () => Promise<void>;
  setAlert: AlertContextType["setAlert"];
}) => {
  const handleUpdatePageName = (name: string, id: number) => {
    const page = pages.find((x) => x.id === id);

    if (page) {
      updatePage({ ...page, name });
      setAlert({
        alertText: `Page name updated to ${name}`,
        alertType: "success",
        location: "bottom",
      });
    }
  };

  const handleUpdatePageKeepEnabled = (id: number, enabled: boolean) => {
    const page = pages.find((x) => x.id === id);

    if (page) {
      updatePage({ ...page, keepEnabled: enabled });
    }
  };

  const handleUpdatePageShowHeaderComments = (
    id: number,
    showHeaderComments: boolean
  ) => {
    const page = pages.find((x) => x.id === id);

    if (page) {
      page.showHeaderComments = showHeaderComments;
      updatePage(page);
    }
  };

  return (
    <div className="pages-tabs__actions">
      <div className="pages-tabs__actions__buttons">
        <Button
          onClick={() =>
            handleUpdatePageKeepEnabled(currentPage.id, !currentPage.keepEnabled)
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
            handleUpdatePageShowHeaderComments(
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
        />
        <Button
          onClick={() => changePageIndex(currentPage.id, currentPage.id + 1)}
          content={">"}
        />
        <Button
          onClick={() => addPage(currentPage)}
          content={<img src="/icons/duplicate.svg" alt="Duplicate" />}
        />
        <PageOptionsDropdown
          page={currentPage}
          darkModeEnabled={darkModeEnabled}
          removePage={() => removePage(currentPage.id, true)}
          updatePageName={(name: string) =>
            handleUpdatePageName(name, currentPage.id)
          }
          toggleDarkMode={toggleDarkMode}
        />
      </div>
    </div>
  );
};

export default PagesTabs;
