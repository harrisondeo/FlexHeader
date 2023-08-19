import { Page, PageHeadersPreset } from "../../utils/settings";
import { useState, useRef, useEffect } from "react";
import "./index.css";
import Button from "../button";

const PageOptionsDropdown = ({
  page,
  removePage,
  updatePageName,
  updatePageKeepEnabled,
  addNewPreset,
}: {
  page: Page;
  removePage: () => void;
  updatePageName: (name: string, id: number) => void;
  updatePageKeepEnabled: (enabled: boolean) => void;
  addNewPreset: (preset: PageHeadersPreset) => void;
}) => {
  const [show, setShow] = useState(false);
  const optionButtonRef = useRef<HTMLDivElement>(null);
  const [optionButtonLocation, setOptionButtonLocation] = useState<
    DOMRect | undefined
  >(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log(optionButtonRef.current);
    if (optionButtonRef.current) {
      // calculate the poosition to be aligned right and below the button
      const rect = optionButtonRef.current.getBoundingClientRect();
      console.log(rect);
      setOptionButtonLocation(rect);
    }
  }, [optionButtonRef]);

  const _addCurrentPageAsPreset = () => {
    const preset: PageHeadersPreset = {
      name: page.name,
      pageSettings: {
        id: page.id,
        name: page.name,
        enabled: page.enabled,
        keepEnabled: page.keepEnabled,
        filters: page.filters,
        headers: page.headers,
      },
    };
    addNewPreset(preset);
  };

  // if user clicks outside of the dropdown when it is open, close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <>
      <div ref={optionButtonRef}>
        <Button
          onClick={() => setShow(!show)}
          size="medium"
          content={<img src="/icons/three-dots.svg" alt="More Settings" />}
        />
      </div>
      <div
        className={`page-options-dropdown ${show && "active"}`}
        ref={dropdownRef}
        style={{
          top: (optionButtonLocation?.bottom || 0) + 5,
          right: (window.innerWidth -
            (optionButtonLocation?.right || 0)) as number,
        }}
      >
        <div className="page-options-dropdown__item">
          <input
            type="text"
            value={page.name}
            onChange={(e) => updatePageName(e.target.value, page.id)}
          />
        </div>
        <div className="page-options-dropdown__item">
          <input
            type="checkbox"
            checked={page.keepEnabled}
            onChange={(e) => updatePageKeepEnabled(e.target.checked)}
          />
          <label>Keep Enabled</label>
        </div>
        <div className="page-options-dropdown__item">
          <Button
            onClick={_addCurrentPageAsPreset}
            width="full"
            content="Save Page to Preset"
          />
        </div>
        <div className="page-options-dropdown__item">
          <Button onClick={removePage} width="full" content="Remove Page" />
        </div>
      </div>
    </>
  );
};

export default PageOptionsDropdown;
