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
import { cx } from "../../utils/cx";
import "./index.css";

interface SettingsPageProps {
  hasReviewed?: boolean;
  onOpenReview?: () => void;
}

const SettingsPage = ({ hasReviewed, onOpenReview }: SettingsPageProps) => {
  const { pages, syncEnabled, lastSyncTime, localModifiedTime, historyEnabled } = useSettingsState();
  const { importSettings, toggleSync, injectError, clearErrors, toggleHistoryEnabled } = useSettingsActions();
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
            className={cx("settings-page__sync-status", {
              "settings-page__sync-status--pending": syncStatus.pending,
            })}
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
              Track header, filter, and page edits so they can be undone with
              Ctrl+Z (Ctrl+Shift+Z to redo).
            </span>
          </span>
        </label>
      </div>

      {!hasReviewed && onOpenReview && (
        <>
          <Divider />
          <div className="settings-page__review-nudge">
            <button
              type="button"
              className="settings-page__review-nudge-button"
              onClick={onOpenReview}
              data-testid="review-nudge"
            >
              Enjoying FlexHeaders? ★ Leave a review
            </button>
          </div>
        </>
      )}

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
