import { useId, useRef, useState } from "react";
import "./index.css";
import Import from "../icons/Import";
import Check from "../icons/Check";
import ErrorIcon from "../icons/ErrorIcon";
import WarningIcon from "../icons/Warning";
import { cx } from "../../utils/cx";

interface DragDropFileProps {
  importSettings: (file: File) => Promise<{ warnings: string[] }>;
  closeCallback?: () => void;
  variant?: "compact" | "large";
}

const DragDropFile = ({
  importSettings,
  closeCallback,
  variant = "compact",
}: DragDropFileProps) => {
  const inputFileId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<
    | { type: "success"; message: string }
    | { type: "warning"; message: string }
    | { type: "error"; message: string }
    | null
  >(null);

  const runImport = async (file: File) => {
    setStatus(null);

    try {
      const { warnings } = await importSettings(file);
      if (warnings.length > 0) {
        // Keep the popup open so the warnings are actually seen, rather than
        // closing immediately the way a clean import does.
        setStatus({ type: "warning", message: warnings.join(" ") });
      } else {
        setStatus({ type: "success", message: "Import successful" });
        closeCallback?.();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      setStatus({ type: "error", message });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  // triggers when file is selected with click
  const handleChange = async function (e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await runImport(e.target.files[0]);
    }
  };

  // triggers the input when the button is clicked
  const onButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (inputRef.current && inputRef.current.click) {
      inputRef.current.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging((prev) => (prev ? prev : true));
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await runImport(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="drag-drop-file__wrapper">
      <form
        className={cx("drag-drop-file", {
          "drag-drop-file--large": variant === "large",
        })}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          id={inputFileId}
          className="drag-drop-file__input"
          accept=".json"
          onChange={handleChange}
          data-testid="import-file-input"
        />
        <label
          htmlFor={inputFileId}
          className={cx("drag-drop-file__label", { dragging: isDragging })}
        >
          <div>
            <Import role="img" aria-label="Import" width={32} height={32} />
            <p className="drag-drop-file__title">
              Drag & drop your exported .json file here
            </p>
            <p className="drag-drop-file__hint">
              Accepts a FlexHeader export or a ModHeader export
            </p>
            <p className="drag-drop-file__subtitle">or</p>
            <button type="button" className="upload-button" onClick={onButtonClick} data-testid="drag-drop-file-upload-button">
              Click to upload a file
            </button>
          </div>
        </label>
      </form>

      {status && (
        <div
          className={`drag-drop-file__status drag-drop-file__status--${status.type}`}
          data-testid="drag-drop-file-status"
        >
          {status.type === "success" && (
            <Check role="img" aria-label="Import successful" width={16} height={16} />
          )}
          {status.type === "warning" && (
            <WarningIcon role="img" aria-label="Import completed with warnings" width={16} height={16} />
          )}
          {status.type === "error" && (
            <ErrorIcon role="img" aria-label="Import failed" width={16} height={16} />
          )}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
};

export default DragDropFile;
