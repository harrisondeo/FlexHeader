import { useRef } from "react";
import "./index.css";

interface DragDropFileProps {
  importSettings: (file: File) => Promise<void>;
  closeCallback: () => void;
}

const DragDropFile = ({ importSettings, closeCallback }: DragDropFileProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // triggers when file is selected with click
  const handleChange = async function (e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await importSettings(e.target.files[0]);
      closeCallback();
    }
  };

  // triggers the input when the button is clicked
  const onButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
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
      <label id="label-file-upload">
        <div>
          <button type="button" className="upload-button" onClick={onButtonClick}>
            Click to upload a file
          </button>
        </div>
      </label>
    </form>
  );
};

export default DragDropFile;
