import { useRef, useState } from "react";
import "./index.css";

interface DragDropFileProps {
  importSettings: (file: File) => void;
  closeCallback: () => void;
}

const DragDropFile = ({ importSettings, closeCallback }: DragDropFileProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // triggers when file is selected with click
  const handleChange = function (e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      importSettings(e.target.files[0]);
      closeCallback();
    }
  };

  // triggers the input when the button is clicked
  const onButtonClick = () => {
    if (inputRef.current && inputRef.current.click) {
      inputRef.current.click();
    }
  };

  return (
    <form className="drag-drop-file">
      <input
        ref={inputRef}
        type="file"
        id="input-file-upload"
        accept=".json"
        onChange={handleChange}
      />
      <label id="label-file-upload" htmlFor="input-file-upload">
        <div>
          <button className="upload-button" onClick={onButtonClick}>
            Click to upload a file
          </button>
        </div>
      </label>
    </form>
  );
};

export default DragDropFile;
