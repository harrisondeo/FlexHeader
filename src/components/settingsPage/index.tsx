import Button from "../button";
import Divider from "../divider";
import DragDropFile from "../dragDropFile";
import ExportPopup from "../exportPopup";
import SyncToggleButton from "../syncToggleButton";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";
import { getSyncStatus } from "../../utils/sync/syncStatus";
import type { LogLevel } from "../../utils/log";
import "./index.css";

const SettingsPage = () => {
  const { pages, syncEnabled, lastSyncTime, localModifiedTime, historyEnabled, logLevel } = useSettingsState();
  const { importSettings, toggleSync, injectError, clearErrors, toggleHistoryEnabled, changeLogLevel } = useSettingsActions();
  const syncStatus = getSyncStatus(lastSyncTime, localModifiedTime);
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <img
          src="logo128.png"
          alt="FlexHeaders Logo"
          width={50}
          height={50}
        />
        <div>
          <h1>Flex Headers Settings</h1>
          <p>Import, export, and manage extension preferences.</p>
        </div>
      </div>

      <Divider />

      <div className="settings-page__section">
        <h2>Import Pages</h2>
        <p>
          Select a previously exported <code>.json</code> file to add its pages
          to Flex Headers.
        </p>
        <DragDropFile importSettings={importSettings} variant="large" />
      </div>

      <Divider />

      <div className="settings-page__section">
        <h2>Export Pages</h2>
        <p>Choose which pages to save to a local JSON file.</p>
        <ExportPopup pages={pages} />
      </div>

      <Divider />

      <div className="settings-page__section">
        <h2>Sync</h2>
        <p>
          Sync your pages across browsers where you are signed in with the same
          account.
        </p>
        <SyncToggleButton
          syncEnabled={syncEnabled}
          onToggle={toggleSync}
          variant="labeled"
          statusText={syncStatus.label}
        />
        {syncEnabled && (
          <p
            className={
              syncStatus.pending
                ? "settings-page__sync-status settings-page__sync-status--pending"
                : "settings-page__sync-status"
            }
            data-testid="sync-status"
          >
            {syncStatus.label}
          </p>
        )}
      </div>

      <Divider />

      <div className="settings-page__section">
        <h2>Experimental Settings</h2>
        <p>Opt-in features still under evaluation.</p>

        <div className="settings-page__experimental-grid">
          <label className="settings-page__toggle">
            <input
              type="checkbox"
              className="settings-page__toggle-input"
              checked={historyEnabled}
              onChange={toggleHistoryEnabled}
              data-testid="history-toggle-button"
            />
            <span className="settings-page__toggle-content">
              <span className="settings-page__toggle-title">Undo / Redo</span>
              <span className="settings-page__toggle-description">
                Track header, filter, and page edits so they can be undone
                with Ctrl+Z (Ctrl+Shift+Z to redo).
              </span>
            </span>
          </label>

          <label className="settings-page__toggle">
            <select
              className="settings-page__field-select"
              value={logLevel}
              onChange={(event) => changeLogLevel(event.target.value as LogLevel)}
              data-testid="log-level-select"
            >
              <option value="error">Errors only</option>
              <option value="warning">Warnings &amp; errors</option>
              <option value="info">All (info, warnings &amp; errors)</option>
            </select>
            <span className="settings-page__toggle-content">
              <span className="settings-page__toggle-title">Log Level</span>
              <span className="settings-page__toggle-description">
                Control how much detail Flex Headers prints to the browser
                console.
              </span>
            </span>
          </label>
        </div>
      </div>

      {import.meta.env.DEV && (
        <>
          <Divider />
          <div className="settings-page__section">
            <h2>Developer Tools</h2>
            <p>Inject and clear test errors to verify the error reporting UI.</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <Button onClick={() => injectError("save")} content="Inject Save Error" />
              <Button onClick={() => injectError("apply")} content="Inject Apply Error" />
              <Button onClick={() => injectError("sync")} content="Inject Sync Error" />
              <Button onClick={() => clearErrors()} content="Clear Errors" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SettingsPage;
