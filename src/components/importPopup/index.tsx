import { useEffect, useRef, useState } from "react";
import Button from "../button";
import "./index.css";
import Divider from "../divider";
import { downloadJSONFile } from "../../utils/download";
import { useAlert } from "../../context/alertContext";
import DragDropFile from "../dragDropFile";

interface ImportPopupProps {
  importSettings: (file: File) => void;
}

const ImportPopup = ({ importSettings }: ImportPopupProps) => {
  const [show, setShow] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const alertContext = useAlert();

  const _handleClick = () => {
    setShow(!show);
  };

  const _handleExport = () => {};

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
      />
      <div className={`import-popup__backdrop ${show ? "show" : ""}`}></div>
      <div className={`import-popup ${show ? "show" : ""}`} ref={popupRef}>
        <div className="import-popup__title">
          <h2>Import Pages</h2>
        </div>
        <Divider thin />
        <div className="import-popup__body">
          {/* Add "on drag or select" component for dropping a file to import */}
          <DragDropFile
            importSettings={importSettings}
            closeCallback={() => {
              setShow(false);
            }}
          />
        </div>
        <Divider thin />
        <div className="import-popup__actions">
          <Button content="Cancel" onClick={() => setShow(false)} />
          <Button
            content={
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <img
                  src="/icons/import.svg"
                  alt="import Pages"
                  width={16}
                  height={16}
                />
                <span>Import</span>
              </div>
            }
            onClick={_handleExport}
          />
        </div>
      </div>
    </>
  );
};

export default ImportPopup;
