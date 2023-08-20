import { useEffect, useRef, useState } from "react";
import Button from "../button";
import "./index.css";
import { Page } from "../../utils/settings";
import Divider from "../divider";
import { downloadJSONFile } from "../../utils/download";
import { useAlert } from "../../context/alertContext";

const ExportPopup = ({ pages }: { pages: Page[] }) => {
  const [show, setShow] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const [selectedPages, setSelectedPages] = useState<Page[]>([]);
  const alertContext = useAlert();

  const _handlePageSelect = (page: Page) => {
    if (selectedPages.includes(page)) {
      setSelectedPages(selectedPages.filter((x) => x.id !== page.id));
    } else {
      setSelectedPages([...selectedPages, page]);
    }
  };

  const _handleClick = () => {
    setShow(!show);
  };

  const _handleExport = () => {
    downloadJSONFile(selectedPages, "FlexHeaders_export.json");
    alertContext.setAlert({
      alertType: "success",
      alertText: "Exported Successfully!",
      location: "bottom",
    });

    setShow(false);
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
              src="/icons/export.svg"
              alt="Add Page"
              width={16}
              height={16}
            />
            <span>Export</span>
          </div>
        }
        onClick={_handleClick}
      />
      <div className={`export-popup__backdrop ${show ? "show" : ""}`}></div>
      <div className={`export-popup ${show ? "show" : ""}`} ref={popupRef}>
        <div className="export-popup__title">
          <h2>Export Pages</h2>
        </div>
        <Divider thin />
        <div className="export-popup__body">
          {pages.map((page) => {
            return (
              <div className="export-popup__page">
                <div className="export-popup__page__name">
                  <input
                    type="checkbox"
                    alt="Select Page for Export"
                    onClick={() => _handlePageSelect(page)}
                    checked={selectedPages.includes(page)}
                  />
                  {page.name}
                </div>
                <div className="export-popup__page__headers">
                  {`${page.headers.length} header(s)`}
                </div>
                <div className="export-popup__page__filters">
                  {`${page.filters.length} filter(s)`}
                </div>
              </div>
            );
          })}
        </div>
        <Divider thin />
        <div className="export-popup__actions">
          <Button content="Cancel" onClick={() => setShow(false)} />
          <Button
            content={
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <img
                  src="/icons/export.svg"
                  alt="Export Pages"
                  width={16}
                  height={16}
                />
                <span>Export</span>
              </div>
            }
            onClick={_handleExport}
          />
        </div>
      </div>
    </>
  );
};

export default ExportPopup;
