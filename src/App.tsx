import "./App.css";
import Divider from "./components/divider";
import useFlexHeaderSettings, {
  Page,
} from "./utils/settings";
import { useCallback, useMemo } from "react";
import PagesTabs from "./components/pagesTabs";
import FilterSection from "./components/filterSection";
import AppHeader from "./components/appHeader";
import AppFooter from "./components/appFooter";
import Alert from "./components/alert";
import { useAlert } from "./context/alertContext";
import SettingsPage from "./components/settingsPage";
import { PagesList } from "./components/pagesList";
import ReviewPrompt from "./components/reviewPrompt";
import useReviewPrompt from "./utils/useReviewPrompt";
import { isRunningInActionPopup } from "./utils/browserContext";
import HeadersList from "./components/headersList";

function App() {
  const {
    pages,
    selectedPage,
    darkModeEnabled,
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
  } = useFlexHeaderSettings();
  const alertContext = useAlert();
  const { shouldShow: shouldShowReviewPrompt, loading: reviewPromptLoading, hidePrompt } = useReviewPrompt();
  const currentPage = useMemo(
    () => pages.find((x) => x.id === selectedPage) || pages[0],
    [pages, selectedPage]
  );

  const _addPage = useCallback(
    async (page?: Page) => {
      const newId = pages.length;

      let newPage: Page = {
        id: newId,
        enabled: true,
        keepEnabled: false,
        showHeaderComments: true,
        filtersExpanded: true,
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

  if (!isRunningInActionPopup()) {
    return (
      <div className={`app app--full-page ${darkModeEnabled ? "darkmode" : ""}`}>
        <SettingsPage />
        <Alert />
      </div>
    );
  }

  return (
    <div className={`app ${darkModeEnabled ? "darkmode" : ""}`}>
      <div className="app__container">
        <AppHeader onAddPage={() => _addPage()} />
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
                pages={pages}
                darkModeEnabled={darkModeEnabled}
                addPage={_addPage}
                updatePage={updatePage}
                removePage={removePage}
                changePageIndex={changePageIndex}
                toggleDarkMode={toggleDarkMode}
                setAlert={alertContext.setAlert}
              />
              <div key={selectedPage} className="app__body__contents">
                <div>
                  {currentPage?.headers?.length === 0 && (
                    <p className="app__body__headers__empty">
                      <i>No headers found. Add a new header.</i>
                    </p>
                  )}
                  <HeadersList
                    currentPageId={currentPage.id}
                    headers={currentPage?.headers}
                    showComments={currentPage.showHeaderComments}
                    removeHeader={removeHeader}
                    updateHeader={updateHeader}
                    saveHeaders={saveHeaders}
                  />
                </div>
                <FilterSection
                  page={currentPage}
                  filters={currentPage?.filters}
                  onUpdate={updateFilter}
                  onRemove={removeFilter}
                  updatePage={updatePage}
                />
              </div>
            </div>
        </div>
        <Divider />
        <AppFooter
          pages={pages}
          currentPageId={currentPage.id}
          onAddHeader={addHeader}
          onAddFilter={addFilter}
          onImportSettings={importSettings}
        />
        <Alert />
        {!reviewPromptLoading && shouldShowReviewPrompt && (
          <ReviewPrompt
            onDismiss={hidePrompt}
            onReview={hidePrompt}
          />
        )}
      </div>
    </div>
  );
}

export default App;
