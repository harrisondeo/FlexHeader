import "./index.css";

export interface SyncToggleButtonProps {
  syncEnabled: boolean;
  onToggle: () => void | Promise<void>;
  variant?: "icon" | "labeled";
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
}: SyncToggleButtonProps) => {
  const description = syncEnabled ? descriptions.disable : descriptions.enable;

  if (variant === "labeled") {
    return (
      <button
        type="button"
        className="sync-toggle-button sync-toggle-button--labeled"
        onClick={onToggle}
        aria-label={description}
        title={description}
        aria-pressed={syncEnabled}
        data-testid="sync-toggle-button"
      >
        <img src="/icons/sync.svg" alt="" aria-hidden="true" />
        <span>{syncEnabled ? "Disable Sync" : "Enable Sync"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="sync-toggle-button sync-toggle-button--icon"
      onClick={onToggle}
      aria-label={description}
      title={description}
      aria-pressed={syncEnabled}
      data-testid="sync-toggle-button"
    >
      <img src="/icons/sync.svg" alt="" aria-hidden="true" />
      {syncEnabled && (
        <span className="sync-toggle-button__active-dot" aria-hidden="true" />
      )}
    </button>
  );
};

export default SyncToggleButton;
