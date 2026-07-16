import { useState, useRef, useEffect } from "react";
import { ISSUES_URL } from "../../constants";
import { AppError, formatErrorReport } from "../../utils/errors";
import "./index.css";

export type ErrorsIconProps = {
  errors: AppError[];
  clearErrors: (category?: AppError["category"]) => Promise<void>;
};

const categoryLabels: Record<AppError["category"], string> = {
  save: "Save Error",
  apply: "Apply Error",
  sync: "Sync Error",
};

const categoryDescriptions: Record<AppError["category"], string> = {
  save: "FlexHeader could not save your settings to storage.",
  apply: "FlexHeader could not apply your header rules to the browser.",
  sync: "FlexHeader could not sync your settings to remote storage.",
};

export const ErrorsIcon = ({ errors, clearErrors }: ErrorsIconProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copyText, setCopyText] = useState("Copy");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const hasErrors = errors.length > 0;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatErrorReport(errors));
      setCopyText("Copied!");
      setTimeout(() => setCopyText("Copy"), 2000);
    } catch {
      setCopyText("Failed");
      setTimeout(() => setCopyText("Copy"), 2000);
    }
  };

  const handleReport = () => {
    const report = formatErrorReport(errors);
    const body = encodeURIComponent(`${report}\n\n<!-- Describe what you were doing when the error occurred -->\n`);
    window.open(`${ISSUES_URL}/new?body=${body}`, "_blank", "noopener,noreferrer");
  };

  const handleDismiss = async (category?: AppError["category"]) => {
    await clearErrors(category);
  };

  if (!hasErrors) {
    return null;
  }

  return (
    <div className="errors-icon">
      <button
        ref={buttonRef}
        type="button"
        className="errors-icon__button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`${errors.length} error${errors.length === 1 ? "" : "s"}`}
        title={`${errors.length} error${errors.length === 1 ? "" : "s"}`}
        data-testid="errors-icon"
      >
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
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {errors.length > 1 && (
          <span className="errors-icon__badge" aria-hidden="true">
            {errors.length}
          </span>
        )}
      </button>
      {isOpen && (
        <div ref={panelRef} className="errors-icon__panel" data-testid="errors-panel">
          <div className="errors-icon__panel-header">
            <h3>Extension Errors</h3>
            <button
              type="button"
              className="errors-icon__close"
              onClick={() => setIsOpen(false)}
              aria-label="Close error panel"
            >
              ×
            </button>
          </div>
          <p className="errors-icon__intro">
            Something went wrong. You can copy the details below or report the issue on GitHub.
          </p>
          <ul className="errors-icon__list">
            {errors.map((error) => (
              <li key={error.id} className={`errors-icon__item errors-icon__item--${error.category}`}>
                <div className="errors-icon__item-header">
                  <span className="errors-icon__category">{categoryLabels[error.category]}</span>
                  <span className="errors-icon__time">
                    {new Date(error.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="errors-icon__message">{error.message}</p>
                {error.details && (
                  <details className="errors-icon__details">
                    <summary>Details</summary>
                    <pre>{error.details}</pre>
                  </details>
                )}
                <p className="errors-icon__description">{categoryDescriptions[error.category]}</p>
              </li>
            ))}
          </ul>
          <div className="errors-icon__actions">
            <button
              type="button"
              className="errors-icon__action errors-icon__action--secondary"
              onClick={handleCopy}
            >
              {copyText}
            </button>
            <button
              type="button"
              className="errors-icon__action errors-icon__action--primary"
              onClick={handleReport}
            >
              Report on GitHub
            </button>
            <button
              type="button"
              className="errors-icon__action errors-icon__action--secondary"
              onClick={() => handleDismiss()}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorsIcon;
