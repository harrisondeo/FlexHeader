import Button from "../button";
import Divider from "../divider";
import DragDropFile from "../dragDropFile";
import ExportPopup from "../exportPopup";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";
import "./index.css";

const SettingsPage = () => {
  const { pages, syncEnabled } = useSettingsState();
  const { importSettings, toggleSync, injectError, clearErrors } = useSettingsActions();
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
        <Button
          onClick={toggleSync}
          content={
            <span
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <img src="/icons/sync.svg" alt="Sync" />
              {syncEnabled ? "Disable Sync" : "Enable Sync"}
            </span>
          }
        />
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
