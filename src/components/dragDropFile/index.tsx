import { useRef, useState } from "react";
import "./index.css";

interface DragDropFileProps {
  importSettings: (file: File) => Promise<void>;
  closeCallback?: () => void;
  variant?: "compact" | "large";
}

const DragDropFile = ({
  importSettings,
  closeCallback,
  variant = "compact",
}: DragDropFileProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<
    { type: "success"; message: string } | { type: "error"; message: string } | null
  >(null);

  const runImport = async (file: File) => {
    setStatus(null);

    try {
      await importSettings(file);
      setStatus({ type: "success", message: "Import successful" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      setStatus({ type: "error", message });
      throw error;
    }

    closeCallback?.();
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
    setIsDragging(true);
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
        className={`drag-drop-file ${variant === "large" ? "drag-drop-file--large" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          id="input-file-upload"
          accept=".json"
          onChange={handleChange}
        />
        <label
          id="label-file-upload"
          className={isDragging ? "dragging" : ""}
        >
          <div>
            <img
              src="/icons/import.svg"
              alt="Import"
              width={32}
              height={32}
            />
            <p className="drag-drop-file__title">
              Drag & drop your exported .json file here
            </p>
            <p className="drag-drop-file__subtitle">or</p>
            <button type="button" className="upload-button" onClick={onButtonClick}>
              Click to upload a file
            </button>
          </div>
        </label>
      </form>

      {status && (
        <div
          className={`drag-drop-file__status ${
            status.type === "success"
              ? "drag-drop-file__status--success"
              : "drag-drop-file__status--error"
          }`}
        >
          <img
            src={`/icons/${status.type === "success" ? "check" : "error"}.svg`}
            alt={status.type === "success" ? "Import successful" : "Import failed"}
            width={16}
            height={16}
          />
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
};

export default DragDropFile;
