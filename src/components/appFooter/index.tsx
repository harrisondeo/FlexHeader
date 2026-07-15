import Button from "../button";
import "./index.css";
import {
  HeaderFilter,
  HeaderSetting,
} from "../../utils/settings";
import { useEffect, useState } from "react";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";

const AppFooter = () => {
  const { currentPage } = useSettingsState();
  const { addHeader, addFilter } = useSettingsActions();
  const currentPageId = currentPage.id;
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
    const newHeader = addHeader(currentPageId, {
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
    addFilter(currentPageId, {
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
        <Button content="Add Header" onClick={handleAddHeader} testId="add-header" />
        <Button content="Add Filter Rule" onClick={handleAddFilter} testId="add-filter" />
      </div>
    </div>
  );
};

export default AppFooter;
