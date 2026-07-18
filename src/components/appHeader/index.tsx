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
import { getSyncStatus } from "../../utils/sync/syncStatus";
import Undo from "../icons/Undo";
import Redo from "../icons/Redo";
import DarkMode from "../icons/DarkMode";
import LightMode from "../icons/LightMode";
import ImportIcon from "../icons/Import";
import SettingsIcon from "../icons/Settings";

const AppHeader = () => {
  const { darkModeEnabled, syncEnabled, pages, errors, lastSyncTime, localModifiedTime, canUndo, canRedo } =
    useSettingsState();
  const { toggleDarkMode, toggleSync, importSettings, clearErrors, undo, redo } =
    useSettingsActions();
  const manifest = browser.runtime.getManifest();
  const isFirefoxPopup = isRunningInActionPopup() && isFirefox();
  const syncStatus = getSyncStatus(lastSyncTime, localModifiedTime);

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
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        data-testid="undo-button"
      >
        <Undo />
      </button>
      <button
        type="button"
        className="app-header__icon-button"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        data-testid="redo-button"
      >
        <Redo />
      </button>
      <button
        type="button"
        className="app-header__icon-button"
        onClick={toggleDarkMode}
        aria-label={darkModeEnabled ? "Disable Dark Mode" : "Enable Dark Mode"}
        title={darkModeEnabled ? "Disable Dark Mode" : "Enable Dark Mode"}
        data-testid="dark-mode-toggle"
      >
        {darkModeEnabled ? <LightMode /> : <DarkMode />}
      </button>
      <SyncToggleButton
        syncEnabled={syncEnabled}
        onToggle={toggleSync}
        statusText={syncStatus.label}
      />
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
                <ImportIcon
                  role="img"
                  aria-label="Import Settings"
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
        <SettingsIcon role="img" aria-label="Settings" />
      </button>
    </div>
  );
};

export default AppHeader;
