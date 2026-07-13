import "./App.css";
import Divider from "./components/divider";
import Button from "./components/button";
import HeaderRow from "./components/headerRow";
import useFlexHeaderSettings, {
  HeaderFilter,
  HeaderSetting,
  Page,
} from "./utils/settings";
import { useCallback, useEffect, useMemo, useState } from "react";
import FilterRow from "./components/filterRow";
import PagesTabs from "./components/pagesTabs";
import Alert from "./components/alert";
import { useAlert } from "./context/alertContext";
import ExportPopup from "./components/exportPopup";
import SettingsPage from "./components/settingsPage";
import DragDropFile from "./components/dragDropFile";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import browser from "webextension-polyfill";
import { PagesList } from "./components/pagesList";
import ReviewPrompt from "./components/reviewPrompt";
import useReviewPrompt from "./utils/useReviewPrompt";
import {
  closeActionPopup,
  isFirefox,
  isRunningInActionPopup,
} from "./utils/browserContext";

const reorder = (
  headers: HeaderSetting[],
  startIndex: number,
  endIndex: number
) => {
  const result = Array.from(headers);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

function App() {
  const {
    pages,
    selectedPage,
    darkModeEnabled,
    syncEnabled,
    addHeader,
    saveHeaders,
    updateHeader,
    removeHeader,
    addFilter,
    updateFilter,
    removeFilter,
    addPage,
    updatePage,
    removePage,
    changeSelectedPage,
    importSettings,
    changePageIndex,
    toggleDarkMode,
    toggleSync,
  } = useFlexHeaderSettings();
  const alertContext = useAlert();
  const { shouldShow: shouldShowReviewPrompt, loading: reviewPromptLoading, hidePrompt } = useReviewPrompt();
  const currentPage = useMemo(
    () => pages.find((x) => x.id === selectedPage) || pages[0],
    [pages, selectedPage]
  );
  const [headerToFocus, setHeaderToFocus] = useState<string | null>(null);

  useEffect(() => {
    if (headerToFocus !== null) {
      const headerElement = document.querySelector(
        `[data-headerid="${headerToFocus}"] .header-row__name input`
      ) as HTMLInputElement;

      if (headerElement) {
        headerElement.focus();
      }

      setHeaderToFocus(null);
    }
  }, [headerToFocus]);

  const _addHeader = useCallback(async () => {
    const newHeader = addHeader(currentPage.id, {
      headerName: "",
      headerValue: "",
      headerComment: "",
      headerEnabled: true,
      headerType: "request",
    });

    setHeaderToFocus(newHeader?.id ?? null);
  }, [currentPage.id, addHeader]);

  const _removeHeader = useCallback(
    async (id: string) => {
      removeHeader(currentPage.id, id);
    },
    [currentPage.id, removeHeader]
  );

  const _updateHeader = useCallback(
    async (header: HeaderSetting) => {
      updateHeader(currentPage.id, header);
    },
    [currentPage.id, updateHeader]
  );

  const _addFilter = useCallback(async () => {
    addFilter(currentPage.id, {
      type: "include",
      mode: "url",
      value: "|http*",
      enabled: true,
      valid: true,
    });
  }, [currentPage.id, addFilter]);

  const _updateFilter = useCallback(
    async (filter: Omit<HeaderFilter, "valid">) => {
      updateFilter(currentPage.id, filter);
    },
    [currentPage.id, updateFilter]
  );

  const _removeFilter = useCallback(
    async (id: string) => {
      removeFilter(currentPage.id, id);
    },
    [currentPage.id, removeFilter]
  );

  const _addPage = useCallback(
    async (page?: Page) => {
      const newId = pages.length;

      let newPage: Page = {
        id: newId,
        enabled: true,
        keepEnabled: false,
        showHeaderComments: true,
        name: "New Page",
        headers: [],
        filters: [],
      };

      if (page) {
        newPage = {
          ...page,
          id: newId,
          name: `New Page ${newId}`,
        };
      }

      addPage(newPage);
    },
    [pages.length, addPage]
  );

  const _updatePageName = useCallback(
    async (name: string, id: number) => {
      const page = pages.find((x) => x.id === id);

      if (page) {
        page.name = name;
        updatePage(page);
        alertContext.setAlert({
          alertText: `Page name updated to ${name}`,
          alertType: "success",
          location: "bottom",
        });
      }
    },
    [pages, updatePage, alertContext]
  );

  const _changePageKeepEnabled = useCallback(
    async (id: number, enabled: boolean) => {
      const page = pages.find((x) => x.id === id);

      if (page) {
        page.keepEnabled = enabled;
        updatePage(page);
      }
    },
    [pages, updatePage]
  );

  const _changePageShowHeaderComments = useCallback(
    async (id: number, showHeaderComments: boolean) => {
      const page = pages.find((x) => x.id === id);

      if (page) {
        page.showHeaderComments = showHeaderComments;
        updatePage(page);
      }
    },
    [pages, updatePage]
  );

  const _onDragEnd = (result: any) => {
    if (!result.destination) {
      return;
    }

    const reorderedHeaders = reorder(
      currentPage.headers,
      result.source.index,
      result.destination.index
    );

    saveHeaders(reorderedHeaders, currentPage.id);
  };

  const manifest = browser.runtime.getManifest();

  const handleReviewPromptDismiss = () => {
    hidePrompt();
  };

  const handleReviewPromptReview = () => {
    hidePrompt();
  };

  const openSettingsForImport = async () => {
    try {
      await browser.runtime.openOptionsPage();
      closeActionPopup();
    } catch (error) {
      console.error("Failed to open settings page for import:", error);
    }
  };

  const isPopup = isRunningInActionPopup();
  const shouldOpenSettingsForImport = isPopup && isFirefox();

  if (!isPopup) {
    return (
      <div className={`app app--full-page ${darkModeEnabled ? "darkmode" : ""}`}>
        <SettingsPage
          pages={pages}
          importSettings={importSettings}
          syncEnabled={syncEnabled}
          toggleSync={toggleSync}
          darkModeEnabled={darkModeEnabled}
          toggleDarkMode={toggleDarkMode}
        />
        <Alert />
      </div>
    );
  }

  return (
    <div className={`app ${darkModeEnabled ? "darkmode" : ""}`}>
      <div className="app__container">
        <div className="app__header">
          <div className="app__header__logo">
            <img
              src="logo128.png"
              alt="FlexHeaders Logo"
              width={50}
              height={50}
            />
            <div>
              <p>Flex Headers</p>
              <div>
                <a
                  href={`https://github.com/harrisondeo/FlexHeader/releases/tag/v${manifest?.version}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  v{manifest?.version}
                </a>
                {` - `}
                <a
                  href={`https://github.com/harrisondeo/FlexHeader/issues`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Feature Requests
                </a>
              </div>
              <div>
                A passion project by{" "}
                <a
                  href="https://harrisondeo.me.uk"
                  target="_blank"
                  rel="noreferrer"
                >
                  Harrison Deo
                </a>
              </div>
            </div>
          </div>
          <Button content="New Page" onClick={() => _addPage()} />
          {/* <span onClick={clear}>Clear Settings</span> */}
        </div>
        <Divider />
        <div className="app__body">
          <PagesList
            pages={pages}
            currentPage={currentPage}
            setCurrentPage={changeSelectedPage}
          />
          <Divider vertical />
          <div style={{ width: "100%" }}>
            <PagesTabs
              currentPage={currentPage}
              addPage={_addPage}
              updatePageName={_updatePageName}
              updatePageKeepEnabled={_changePageKeepEnabled}
              updatePageShowHeaderComments={_changePageShowHeaderComments}
              removePage={removePage}
              changePageIndex={changePageIndex}
            />
            <div key={selectedPage} className="app__body__contents">
              <div>
                {currentPage?.headers?.length === 0 && (
                  <p className="app__body__headers__empty">
                    <i>No headers found. Add a new header.</i>
                  </p>
                )}
                <DragDropContext onDragEnd={_onDragEnd}>
                  <Droppable droppableId="droppable-headers">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="app__body__headers"
                      >
                        {currentPage?.headers?.map(
                          (
                            { id, headerName, headerValue, headerComment, headerEnabled, headerType },
                            index
                          ) => (
                            <Draggable key={id} draggableId={id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                >
                                  <HeaderRow
                                    key={`header-row__${id}`}
                                    id={id}
                                    headerName={headerName}
                                    headerValue={headerValue}
                                    headerComment={headerComment}
                                    headerEnabled={headerEnabled}
                                    headerType={headerType}
                                    showComment={currentPage.showHeaderComments}
                                    onRemove={(id: string) => _removeHeader(id)}
                                    onUpdate={_updateHeader}
                                    dragHandleProps={provided.dragHandleProps}
                                  />
                                </div>
                              )}
                            </Draggable>
                          )
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
              {currentPage?.filters?.length > 0 && (
                <div className="app__body__filters">
                  <p>Filters (URL or Regex)</p>
                  <div className="app__body__filters__container">
                    {currentPage?.filters.map((filter) => (
                      <FilterRow
                        key={`filter-row__${filter.id}`}
                        {...filter}
                        onRemove={_removeFilter}
                        onUpdate={_updateFilter}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <Divider />
        <div className="app__footer">
          <div className="app__footer__action_block">
            <Button content="Add Header" onClick={_addHeader} />
            <Button content="Add Filter Rule" onClick={_addFilter} />
          </div>
          <div className="app__footer__action_block">
            {shouldOpenSettingsForImport ? (
              <Button
                content={
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <img
                      src="/icons/import.svg"
                      alt="Import Settings"
                      width={16}
                      height={16}
                    />
                    <span>Import</span>
                  </div>
                }
                onClick={openSettingsForImport}
              />
            ) : (
              <DragDropFile
                importSettings={importSettings}
                closeCallback={() => {
                  // Inline import in the popup: no extra UI to close.
                }}
              />
            )}
            <ExportPopup pages={pages} />
          </div>
        </div>
        <Alert />
        {!reviewPromptLoading && shouldShowReviewPrompt && (
          <ReviewPrompt
            onDismiss={handleReviewPromptDismiss}
            onReview={handleReviewPromptReview}
          />
        )}
      </div>
    </div >
  );
}

export default App;
