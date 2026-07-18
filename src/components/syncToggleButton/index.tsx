import "./index.css";
import Sync from "../icons/Sync";

export interface SyncToggleButtonProps {
  syncEnabled: boolean;
  onToggle: () => void | Promise<void>;
  variant?: "icon" | "labeled";
  statusText?: string;
}

const descriptions = {
  enable:
    "Enable Sync — sync your pages across browsers where you're signed in with the same account",
  disable:
    "Disable Sync — stop syncing your pages, each browser keeps its own copy",
};

const SyncToggleButton = ({
  syncEnabled,
  onToggle,
  variant = "icon",
  statusText,
}: SyncToggleButtonProps) => {
  const description = syncEnabled ? descriptions.disable : descriptions.enable;
  const tooltip = syncEnabled && statusText ? `${description} — ${statusText}` : description;

  if (variant === "labeled") {
    return (
      <button
        type="button"
        className="sync-toggle-button sync-toggle-button--labeled"
        onClick={onToggle}
        aria-label={tooltip}
        title={tooltip}
        aria-pressed={syncEnabled}
        data-testid="sync-toggle-button"
      >
        <Sync aria-hidden="true" />
        <span>{syncEnabled ? "Disable Sync" : "Enable Sync"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="sync-toggle-button sync-toggle-button--icon"
      onClick={onToggle}
      aria-label={tooltip}
      title={tooltip}
      aria-pressed={syncEnabled}
      data-testid="sync-toggle-button"
    >
      <Sync aria-hidden="true" />
      {syncEnabled && (
        <span className="sync-toggle-button__active-dot" aria-hidden="true" />
      )}
    </button>
  );
};

export default SyncToggleButton;
