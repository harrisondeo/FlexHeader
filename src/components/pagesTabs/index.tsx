import { useState } from "react";
import { Page, PageHeadersPreset } from "../../utils/settings";
import AddPresetpopup from "../addPresetPopup";
import Button from "../button";
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
  addNewPreset,
}: {
  pages: Page[];
  currentPage: Page;
  setCurrentPage: (id: number) => void;
  addPage: () => void;
  removePage: (id: number) => void;
  updatePageName: (name: string, id: number) => void;
  updatePageKeepEnabled: (id: number, enabled: boolean) => void;
  addNewPreset: (preset: PageHeadersPreset) => void;
}) => {
  const [showAddPresetPopup, setShowAddPresetPopup] = useState(false);

  const _onKeepEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updatePageKeepEnabled(currentPage.id, e.target.checked);
  };

  const _onAddPageToPreset = () => {
    setShowAddPresetPopup(true);
  };

  const _onAddPreset = (name: string) => {
    alert(name);
    setShowAddPresetPopup(false);
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
            removePage={() => {}}
            updatePageName={(name: string) =>
              updatePageName(name, currentPage.id)
            }
            updatePageKeepEnabled={(enabled: boolean) =>
              updatePageKeepEnabled(currentPage.id, enabled)
            }
            addNewPreset={addNewPreset}
          />
        </div>
      </div>
      <AddPresetpopup show={showAddPresetPopup} onSubmit={_onAddPreset} />
    </>
  );
};

export default PagesTabs;
