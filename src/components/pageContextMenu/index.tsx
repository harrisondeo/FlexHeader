import { useEffect, useRef } from "react";
import { Page } from "../../utils/settings";
import "./index.css";
import { useSettingsActions } from "../../context/settingsContext";
import Power from "../icons/Power";
import Duplicate from "../icons/Duplicate";
import Delete from "../icons/Delete";

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
      pageId: undefined,
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
          <Power className="page-context-menu__icon" />
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
          <Duplicate className="page-context-menu__icon" />
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
          <Delete className="page-context-menu__icon" />
          Delete Page
        </button>
      </div>
    </div>
  );
};

export default PageContextMenu;
