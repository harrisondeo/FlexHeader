import Button from "../button";
import ExportPopup from "../exportPopup";
import ImportPopup from "../importPopup";
import "./index.css";
import {
  HeaderFilter,
  HeaderSetting,
  Page,
} from "../../utils/settings";
import {
  isFirefox,
  isRunningInActionPopup,
  openOptionsPageAndClosePopup,
} from "../../utils/browserContext";
import { useEffect, useState } from "react";

interface AppFooterProps {
  pages: Page[];
  currentPageId: number;
  onAddHeader: (
    pageId: number,
    header: Omit<HeaderSetting, "id">
  ) => HeaderSetting | undefined;
  onAddFilter: (
    pageId: number,
    filter: Omit<HeaderFilter, "id">
  ) => void;
  onImportSettings: (file: File) => Promise<void>;
}

const AppFooter = ({
  pages,
  currentPageId,
  onAddHeader,
  onAddFilter,
  onImportSettings,
}: AppFooterProps) => {
  const shouldOpenSettingsForImport =
    isRunningInActionPopup() && isFirefox();
  const [headerToFocus, setHeaderToFocus] = useState<string | null>(null);

  useEffect(() => {
    if (headerToFocus !== null) {
      const headerElement = document.querySelector(
        `[data-headerid="${headerToFocus}"] .header-row__name input`
      ) as HTMLInputElement;

      if (headerElement) {
        headerElement.focus();
      }

      setHeaderToFocus(null);
    }
  }, [headerToFocus]);

  const handleAddHeader = () => {
    const newHeader = onAddHeader(currentPageId, {
      headerName: "",
      headerValue: "",
      headerComment: "",
      headerEnabled: true,
      headerType: "request",
    });

    if (newHeader?.id) {
      setHeaderToFocus(newHeader.id);
    }
  };

  const handleAddFilter = () => {
    onAddFilter(currentPageId, {
      type: "include",
      mode: "url",
      value: "|http*",
      enabled: true,
      valid: true,
    });
  };

  return (
    <div className="app-footer">
      <div className="app-footer__action_block">
        <Button content="Add Header" onClick={handleAddHeader} />
        <Button content="Add Filter Rule" onClick={handleAddFilter} />
      </div>
      <div className="app-footer__action_block">
        {shouldOpenSettingsForImport ? (
          <Button
            content={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <img
                  src="/icons/import.svg"
                  alt="Import Settings"
                  width={16}
                  height={16}
                />
                <span>Import</span>
              </div>
            }
            onClick={openOptionsPageAndClosePopup}
          />
        ) : (
          <ImportPopup importSettings={onImportSettings} />
        )}
        <ExportPopup pages={pages} />
      </div>
    </div>
  );
};

export default AppFooter;
