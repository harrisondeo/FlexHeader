import Button from "../button";
import Divider from "../divider";
import DragDropFile from "../dragDropFile";
import ExportPopup from "../exportPopup";
import { Page } from "../../utils/settings";
import "./index.css";

interface SettingsPageProps {
  pages: Page[];
  importSettings: (file: File) => Promise<void>;
  syncEnabled: boolean;
  toggleSync: () => Promise<void>;
  darkModeEnabled: boolean;
  toggleDarkMode: () => Promise<void>;
}

const SettingsPage = ({
  pages,
  importSettings,
  syncEnabled,
  toggleSync,
  darkModeEnabled,
  toggleDarkMode,
}: SettingsPageProps) => {
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
        <h2>Appearance</h2>
        <Button
          onClick={toggleDarkMode}
          content={
            <span
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <img src="/icons/dark-mode.svg" alt="Dark Mode" />
              {darkModeEnabled ? "Disable Dark Mode" : "Enable Dark Mode"}
            </span>
          }
        />
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
    </div>
  );
};

export default SettingsPage;
