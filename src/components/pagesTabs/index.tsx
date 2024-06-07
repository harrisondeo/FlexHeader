import { Page } from "../../utils/settings";
import PageTab from "../pageTab";
import "./index.css";
import PageOptionsDropdown from "../pageOptionsDropdown";
import { useState, useEffect, useRef } from "react";
import Button from "../button";

const ExpandedPagesDropdown = ({
  pages,
  show,
  setShow,
  onPageClick,
}: {
  pages: Page[];
  show: boolean;
  setShow: (show: boolean) => void;
  onPageClick: (id: number) => void;
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  if (!show) return null;

  return (
    <div className="expanded-pages-dropdown" ref={dropdownRef}>
      <div className="expanded-pages-dropdown__contents">
        {pages.map((page) => (
          <span onClick={() => onPageClick(page.id)}>{page.name}</span>
        ))}
      </div>
    </div>
  );
};

const PagesTabs = ({
  pages,
  currentPage,
  darkModeEnabled,
  setCurrentPage,
  addPage,
  removePage,
  updatePageName,
  updatePageKeepEnabled,
  changePageIndex,
  toggleDarkMode,
}: {
  pages: Page[];
  currentPage: Page;
  darkModeEnabled: boolean;
  setCurrentPage: (id: number) => void;
  addPage: (page?: Page) => void;
  removePage: (id: number, autoSelectPage: boolean) => void;
  updatePageName: (name: string, id: number) => void;
  updatePageKeepEnabled: (id: number, enabled: boolean) => void;
  changePageIndex: (id: number, newIndex: number) => void;
  toggleDarkMode: () => void;
}) => {
  const [pagesToShow, setPagesToShow] = useState(pages);
  const [expandedPages, setExpandedPages] = useState<Page[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const tabsContainer = document.querySelector(".pages-tabs");
    const tabsContainerWidth = tabsContainer?.clientWidth || 0;

    const tabsDropdown = document.querySelector(".page-tabs__show-all");
    const tabsDropdownWidth = tabsDropdown?.clientWidth || 0;

    const tabs = document.querySelectorAll(".page-tab");

    const pagesToShow = Math.floor(
      (tabsContainerWidth - tabsDropdownWidth) / tabs[0].clientWidth
    );

    let visiblePages = pages.slice(0, pagesToShow);
    let expandedPages = pages.slice(pagesToShow);

    if (expandedPages.includes(currentPage)) {
      // take the current page out of the expanded pages
      expandedPages = expandedPages.filter((x) => x.id !== currentPage.id);
      // remove the last page from the visible pages but add to the expanded list
      expandedPages.unshift(visiblePages.pop() as Page);
      // add the current page to the visible pages
      visiblePages.push(currentPage);
    }

    setPagesToShow(visiblePages);
    setExpandedPages(expandedPages);
  }, [pages]);

  return (
    <>
      <div className="pages-tabs">
        {pagesToShow.map((page) => (
          <PageTab
            key={page.id}
            page={page}
            active={page.id === currentPage.id}
            setCurrentPage={setCurrentPage}
            updatePage={updatePageName}
          />
        ))}
        {expandedPages.length > 0 && (
          <div
            className="page-tabs__show-all"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <img
              src="icons/expand-arrow.svg"
              alt="arrow-left"
              width={18}
              height={18}
            />
          </div>
        )}
        {/* <div
          key={"page-tab-new"}
          className={`page-tab`}
          onClick={() => addPage()}
        >
          +
        </div> */}
      </div>
      <ExpandedPagesDropdown
        show={showDropdown}
        pages={expandedPages}
        setShow={setShowDropdown}
        onPageClick={(id: number) => {
          setCurrentPage(id);
          setShowDropdown(false);
        }}
      />
      <div className="pages-tabs__actions">
        <div className="pages-tabs__actions__buttons">
          <input
            type="checkbox"
            checked={currentPage.keepEnabled}
            onChange={(e) =>
              updatePageKeepEnabled(currentPage.id, e.target.checked)
            }
          />
          <label>Enabled in background</label>
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
    </>
  );
};

export default PagesTabs;
