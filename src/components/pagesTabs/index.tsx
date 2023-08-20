import { Page } from "../../utils/settings";
import PageTab from "../pageTab";
import "./index.css";
import PageOptionsDropdown from "../pageOptionsDropdown";

const PagesTabs = ({
  pages,
  currentPage,
  setCurrentPage,
  addPage,
  removePage,
  updatePageName,
  updatePageKeepEnabled,
}: {
  pages: Page[];
  currentPage: Page;
  setCurrentPage: (id: number) => void;
  addPage: () => void;
  removePage: (id: number) => void;
  updatePageName: (name: string, id: number) => void;
  updatePageKeepEnabled: (id: number, enabled: boolean) => void;
}) => {
  const _onKeepEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updatePageKeepEnabled(currentPage.id, e.target.checked);
  };

  return (
    <>
      <div className="pages-tabs">
        {pages.map((page) => (
          <PageTab
            key={page.id}
            page={page}
            active={page.id === currentPage.id}
            setCurrentPage={setCurrentPage}
            updatePage={updatePageName}
          />
        ))}
        <div
          key={"page-tab-new"}
          className={`page-tab`}
          onClick={() => addPage()}
        >
          +
        </div>
      </div>
      <div className="pages-tabs__actions">
        <div className="pages-tabs__actions__buttons">
          <PageOptionsDropdown
            page={currentPage}
            removePage={() => removePage(currentPage.id)}
            updatePageName={(name: string) =>
              updatePageName(name, currentPage.id)
            }
            updatePageKeepEnabled={(enabled: boolean) =>
              updatePageKeepEnabled(currentPage.id, enabled)
            }
          />
        </div>
      </div>
    </>
  );
};

export default PagesTabs;
