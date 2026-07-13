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
        <input
          id={`keepEnabled-${currentPage.id}`}
          type="checkbox"
          checked={currentPage.keepEnabled}
          onChange={(e) =>
            updatePageKeepEnabled(currentPage.id, e.target.checked)
          }
        />
        <label htmlFor={`keepEnabled-${currentPage.id}`}>
          Enabled in background
        </label>
        <input
          id={`showHeaderComments-${currentPage.id}`}
          type="checkbox"
          checked={currentPage.showHeaderComments}
          onChange={(e) =>
            updatePageShowHeaderComments(currentPage.id, e.target.checked)
          }
        />
        <label htmlFor={`showHeaderComments-${currentPage.id}`}>
          Show header comments
        </label>
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
            updatePageName(name, currentPage.id)
          }
          toggleDarkMode={toggleDarkMode}
        />
      </div>
    </div>
  );
};

export default PagesTabs;
