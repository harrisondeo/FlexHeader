import browser from "webextension-polyfill";
import "./index.css";
import Button from "../button";
import {
  isFirefox,
  isRunningInActionPopup,
  openOptionsPageAndClosePopup,
} from "../../utils/browserContext";
import ExportPopup from "../exportPopup";
import ImportPopup from "../importPopup";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";
import ErrorsIcon from "../errorsIcon";
import SyncToggleButton from "../syncToggleButton";

const AppHeader = () => {
  const { darkModeEnabled, syncEnabled, pages, errors } = useSettingsState();
  const { toggleDarkMode, toggleSync, importSettings, clearErrors } =
    useSettingsActions();
  const manifest = browser.runtime.getManifest();
  const isFirefoxPopup = isRunningInActionPopup() && isFirefox();

  return (
    <div className="app-header">
      <img
        className="app-header__logo"
        src="logo128.png"
        alt="FlexHeaders Logo"
        width={32}
        height={32}
      />
      <div className="app-header__info">
        <div className="app-header__title-row">
          <p className="app-header__name">Flex Headers</p>
          <span className="app-header__meta">
            <a
              href={`https://github.com/harrisondeo/FlexHeader/releases/tag/v${manifest?.version}`}
              target="_blank"
              rel="noreferrer"
            >
              v{manifest?.version}
            </a>
            {" · "}
            <a
              href={`https://github.com/harrisondeo/FlexHeader/issues`}
              target="_blank"
              rel="noreferrer"
            >
              Feature Requests
            </a>
          </span>
        </div>
        <div className="app-header__credit">
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
      <button
        type="button"
        className="app-header__icon-button"
        onClick={toggleDarkMode}
        aria-label={darkModeEnabled ? "Disable Dark Mode" : "Enable Dark Mode"}
        title={darkModeEnabled ? "Disable Dark Mode" : "Enable Dark Mode"}
        data-testid="dark-mode-toggle"
      >
        {darkModeEnabled ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect width="48" height="48" fill="none" />
            <path d="M14,24A10,10,0,0,0,24,34V14A10,10,0,0,0,14,24Z" />
            <path d="M24,2A22,22,0,1,0,46,24,21.9,21.9,0,0,0,24,2ZM6,24A18.1,18.1,0,0,1,24,6v8a10,10,0,0,1,0,20v8A18.1,18.1,0,0,1,6,24Z" />
          </svg>
        )}
      </button>
      <SyncToggleButton syncEnabled={syncEnabled} onToggle={toggleSync} />
      <div className="app-header__actions">
        <ErrorsIcon errors={errors} clearErrors={clearErrors} />
        {isFirefoxPopup ? (
          <Button
            content={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <img
                  src="/icons/import.svg"
                  alt="Import Settings"
                  width={16}
                  height={16}
                />
                <span>Import</span>
              </div>
            }
            onClick={openOptionsPageAndClosePopup}
            testId="import-button"
            title="Open settings to import pages"
          />
        ) : (
          <ImportPopup importSettings={importSettings} />
        )}
        <ExportPopup pages={pages} />
      </div>
      <button
        type="button"
        className="app-header__icon-button"
        onClick={openOptionsPageAndClosePopup}
        aria-label="Settings"
        title="Settings"
        data-testid="header-settings"
      >
        <img src="/icons/settings.svg" alt="Settings" />
      </button>
    </div>
  );
};

export default AppHeader;
