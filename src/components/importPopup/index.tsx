import { useEffect, useRef, useState } from "react";
import Button from "../button";
import "./index.css";
import Divider from "../divider";
import DragDropFile from "../dragDropFile";

interface ImportPopupProps {
  importSettings: (file: File) => Promise<void>;
}

const ImportPopup = ({ importSettings }: ImportPopupProps) => {
  const [show, setShow] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const _handleClick = () => {
    setShow(!show);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [popupRef]);

  return (
    <>
      <Button
        content={
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <img
              src="/icons/import.svg"
              alt="Import Settings"
              width={16}
              height={16}
            />
            <span>Import</span>
          </div>
        }
        onClick={_handleClick}
        testId="import-button"
      />
      <div className={`import-popup__backdrop ${show ? "show" : ""}`}></div>
      <div className={`import-popup ${show ? "show" : ""}`} ref={popupRef} data-testid="import-popup">
        <div className="import-popup__title">
          <h2>Import Pages</h2>
        </div>
        <Divider thin />
        <div className="import-popup__body">
          <DragDropFile
            importSettings={importSettings}
            closeCallback={() => {
              setShow(false);
            }}
            variant="large"
          />
        </div>
        <Divider thin />
        <div className="import-popup__actions">
          <Button content="Cancel" onClick={() => setShow(false)} />
        </div>
      </div>
    </>
  );
};

export default ImportPopup;
