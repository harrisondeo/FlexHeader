import { useEffect } from "react";
import "./App.css";
import FilterSection from "./components/filterSection";
import AppHeader from "./components/appHeader";
import AppFooter from "./components/appFooter";
import Alert from "./components/alert";
import SettingsPage from "./components/settingsPage";
import { PagesList } from "./components/pagesList";
import ReviewPrompt from "./components/reviewPrompt";
import useReviewPrompt from "./utils/useReviewPrompt";
import { isRunningInActionPopup } from "./utils/browserContext";
import HeadersList from "./components/headersList";
import PageTitle from "./components/pageTitle";
import { useSettingsState, useSettingsActions } from "./context/settingsContext";

function App() {
  const { selectedPage, currentPage, darkModeEnabled } = useSettingsState();
  const { undo, redo } = useSettingsActions();
  const { shouldShow: shouldShowReviewPrompt, loading: reviewPromptLoading, hidePrompt } = useReviewPrompt();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;
      if (!isModifier || e.key.toLowerCase() !== "z") return;

      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

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
        <AppHeader />
        <div className="app__body">
          <PagesList />
          <div style={{ width: "100%", marginTop: "0.5rem" }}>
            <PageTitle />
            <div key={selectedPage} className="app__body__contents">
              <div className="headers-panel">
                {currentPage?.headers?.length === 0 && (
                  <p className="app__body__headers__empty">
                    <i>No headers found. Add a new header.</i>
                  </p>
                )}
                <HeadersList />
              </div>
              <FilterSection />
            </div>
          </div>
        </div>
        <AppFooter />
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
