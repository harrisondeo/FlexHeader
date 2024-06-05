import { Page } from "../../utils/settings";
import { useState, useRef, useEffect } from "react";
import "./index.css";
import Button from "../button";

const PageOptionsDropdown = ({
  page,
  removePage,
  updatePageName,
}: {
  page: Page;
  removePage: () => void;
  updatePageName: (name: string, id: number) => void;
}) => {
  const [show, setShow] = useState(false);
  const optionButtonRef = useRef<HTMLDivElement>(null);
  const [optionButtonLocation, setOptionButtonLocation] = useState<
    DOMRect | undefined
  >(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (optionButtonRef.current) {
      const rect = optionButtonRef.current.getBoundingClientRect();
      setOptionButtonLocation(rect);
    }
  }, [optionButtonRef]);

  const _removePage = () => {
    removePage();
    setShow(false);
  };

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
          {/* <FeedbackButton
            onClick={_addCurrentPageAsPreset}
            width="full"
            content="Save Page to Preset"
            intermediateContent={<img src="/icons/check.svg" alt="Saved" />}
          /> */}
        </div>
        <div className="page-options-dropdown__item">
          <Button onClick={_removePage} width="full" content="Delete Page" />
        </div>
      </div>
    </>
  );
};

export default PageOptionsDropdown;
