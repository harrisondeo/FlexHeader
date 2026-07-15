import { useEffect, useRef } from "react";
import { Page } from "../../utils/settings";
import "./index.css";
import { useSettingsActions } from "../../context/settingsContext";

interface PageContextMenuProps {
  page: Page | undefined;
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
}

const MENU_WIDTH = 190;
const MENU_HEIGHT = 152;

export const PageContextMenu = ({
  page,
  visible,
  x,
  y,
  onClose,
}: PageContextMenuProps) => {
  const { addPage, updatePage, removePage } = useSettingsActions();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, onClose]);

  if (!visible || !page) {
    return null;
  }

  const adjustedX = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
  const adjustedY = Math.min(y, window.innerHeight - MENU_HEIGHT - 8);

  const handleToggle = () => {
    updatePage({ ...page, keepEnabled: !page.keepEnabled });
  };

  const handleDuplicate = () => {
    addPage({
      ...page,
      id: -1,
      name: `${page.name} Copy`,
    });
    onClose();
  };

  const handleDelete = () => {
    removePage(page.id, true);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="page-context-menu"
      style={{ left: adjustedX, top: adjustedY }}
      data-testid="page-context-menu"
      role="menu"
    >
      <div className="page-context-menu__item">
        <button
          type="button"
          className={`page-context-menu__button ${
            page.keepEnabled
              ? "page-context-menu__button--background-active"
              : "page-context-menu__button--background"
          }`}
          onClick={handleToggle}
          aria-label={
            page.keepEnabled
              ? "Disable background running"
              : "Enable background running"
          }
          data-testid="page-context-toggle-background"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="-2 0 19 19"
            fill="currentColor"
            aria-hidden="true"
            className="page-context-menu__icon"
          >
            <path d="M7.498 17.1a7.128 7.128 0 0 1-.98-.068 7.455 7.455 0 0 1-1.795-.483 7.26 7.26 0 0 1-3.028-2.332A7.188 7.188 0 0 1 .73 12.52a7.304 7.304 0 0 1 .972-7.128 7.221 7.221 0 0 1 1.387-1.385 1.03 1.03 0 0 1 1.247 1.638 5.176 5.176 0 0 0-.993.989 5.313 5.313 0 0 0-.678 1.181 5.23 5.23 0 0 0-.348 1.292 5.22 5.22 0 0 0 .326 2.653 5.139 5.139 0 0 0 .69 1.212 5.205 5.205 0 0 0 .992.996 5.257 5.257 0 0 0 1.178.677 5.37 5.37 0 0 0 1.297.35 5.075 5.075 0 0 0 1.332.008 5.406 5.406 0 0 0 1.32-.343 5.289 5.289 0 0 0 2.211-1.682 5.18 5.18 0 0 0 1.02-2.465 5.2 5.2 0 0 0 .01-1.336 5.315 5.315 0 0 0-.343-1.318 5.195 5.195 0 0 0-.695-1.222 5.134 5.134 0 0 0-.987-.989 1.03 1.03 0 1 1 1.24-1.643 7.186 7.186 0 0 1 1.384 1.386 7.259 7.259 0 0 1 .97 1.706 7.413 7.413 0 0 1 .473 1.827 7.296 7.296 0 0 1-4.522 7.65 7.476 7.476 0 0 1-1.825.471 7.203 7.203 0 0 1-.89.056zM7.5 9.613a1.03 1.03 0 0 1-1.03-1.029V2.522a1.03 1.03 0 0 1 2.06 0v6.062a1.03 1.03 0 0 1-1.03 1.03z" />
          </svg>
          Run in background
        </button>
      </div>
      <div className="page-context-menu__item">
        <button
          type="button"
          className="page-context-menu__button page-context-menu__button--duplicate"
          onClick={handleDuplicate}
          aria-label="Duplicate page"
          data-testid="page-context-duplicate"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="page-context-menu__icon"
          >
            <path d="M18 3H4C3.44772 3 3 3.44772 3 4V18C3 18.5523 2.55228 19 2 19C1.44772 19 1 18.5523 1 18V4C1 2.34315 2.34315 1 4 1H18C18.5523 1 19 1.44772 19 2C19 2.55228 18.5523 3 18 3Z" />
            <path d="M13 11C13 10.4477 13.4477 10 14 10C14.5523 10 15 10.4477 15 11V13H17C17.5523 13 18 13.4477 18 14C18 14.5523 17.5523 15 17 15H15V17C15 17.5523 14.5523 18 14 18C13.4477 18 13 17.5523 13 17V15H11C10.4477 15 10 14.5523 10 14C10 13.4477 10.4477 13 11 13H13V11Z" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M20 5C21.6569 5 23 6.34315 23 8V20C23 21.6569 21.6569 23 20 23H8C6.34315 23 5 21.6569 5 20V8C5 6.34315 6.34315 5 8 5H20ZM20 7C20.5523 7 21 7.44772 21 8V20C21 20.5523 20.5523 21 20 21H8C7.44772 21 7 20.5523 7 20V8C7 7.44772 7.44772 7 8 7H20Z"
            />
          </svg>
          Duplicate Page
        </button>
      </div>
      <div className="page-context-menu__item">
        <button
          type="button"
          className="page-context-menu__button page-context-menu__button--delete"
          onClick={handleDelete}
          aria-label="Delete page"
          data-testid="page-context-delete"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="page-context-menu__icon"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8.53113 1C5.52364 1 3.19671 3.63591 3.56974 6.62017L5.28873 20.3721C5.47639 21.8734 6.7526 23 8.26557 23H15.7344C17.2474 23 18.5236 21.8734 18.7113 20.3721L20.4303 6.62017C20.8033 3.63591 18.4764 1 15.4689 1H8.53113ZM5.70148 5C6.11066 3.8455 7.21175 3 8.53113 3H15.4689C16.7883 3 17.8893 3.8455 18.2985 5H5.70148ZM5.63279 7L7.27329 20.124C7.33584 20.6245 7.76124 21 8.26557 21H15.7344C16.2388 21 16.6642 20.6245 16.7267 20.124L18.3672 7H5.63279Z"
            />
            <path d="M15.002 10.998C14.6114 10.6075 13.9783 10.6075 13.5878 10.998L12 12.5858L10.4201 11.0058C10.0296 10.6153 9.3964 10.6153 9.00587 11.0058C8.61535 11.3964 8.61535 12.0295 9.00587 12.4201L10.5858 14L9.00001 15.5858C8.60949 15.9763 8.60949 16.6095 9.00001 17C9.39054 17.3905 10.0237 17.3905 10.4142 17L12 15.4142L13.5878 17.0019C13.9783 17.3925 14.6114 17.3925 15.002 17.0019C15.3925 16.6114 15.3925 15.9782 15.002 15.5877L13.4142 14L15.002 12.4123C15.3925 12.0217 15.3925 11.3886 15.002 10.998Z" />
          </svg>
          Delete Page
        </button>
      </div>
    </div>
  );
};

export default PageContextMenu;
