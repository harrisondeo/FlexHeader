import { useEffect, useState, MouseEventHandler } from "react";
import { Page } from "../../utils/settings";
import Button from "../button";
import PageContextMenu from "../pageContextMenu";
import "./index.css";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";

export const PagesList = () => {
  const { pages, currentPage } = useSettingsState();
  const { addPage } = useSettingsActions();
  const [collapsed, setCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    page: Page;
    x: number;
    y: number;
  } | null>(null);

  const handleAddPage = () => {
    addPage({
      id: pages.length,
      enabled: true,
      keepEnabled: false,
      showHeaderComments: true,
      filtersExpanded: true,
      name: "New Page",
      headers: [],
      filters: [],
    });
  };

  useEffect(() => {
    const activePage = document.querySelector(".page-list-item.active");
    //@ts-ignore
    activePage?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [currentPage]);

  return (
    <div
      className={`pages-list ${collapsed ? "pages-list--collapsed" : ""}`}
      data-testid="pages-list"
    >
      <div className="pages-list__header">
        {!collapsed && <span className="pages-list__title">Pages</span>}
        <div className="pages-list__header-actions">
          {!collapsed && (
            <Button
              content="+"
              size="small"
              onClick={handleAddPage}
              ariaLabel="Add new page"
              testId="new-page"
            />
          )}
          <Button
            content={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`pages-list__collapse-icon ${
                  collapsed ? "" : "pages-list__collapse-icon--expanded"
                }`}
              >
                <path d="M11 19L17 12L11 5" />
                <path d="M7 19L13 12L7 5" />
              </svg>
            }
            size="small"
            color="secondary"
            onClick={() => setCollapsed(!collapsed)}
            ariaLabel={collapsed ? "Expand pages list" : "Collapse pages list"}
            title={collapsed ? "Expand pages list" : "Collapse pages list"}
            testId="toggle-pages-list"
          />
        </div>
      </div>
      {pages.map((page) => (
        <PageListItem
          key={page.id}
          page={page}
          collapsed={collapsed}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({ page, x: event.clientX, y: event.clientY });
          }}
        />
      ))}
      <PageContextMenu
        page={contextMenu?.page}
        visible={!!contextMenu}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
};

const PageListItem = ({
  page,
  collapsed,
  onContextMenu,
}: {
  page: Page;
  collapsed: boolean;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
}) => {
  const { currentPage } = useSettingsState();
  const { changeSelectedPage } = useSettingsActions();
  const active = page.id === currentPage.id;
  const backgroundActive = page.keepEnabled;
  const initial = page.name.charAt(0).toUpperCase();

  return (
    <div
      className={`page-list-item ${backgroundActive ? "background" : ""} ${
        active ? "active" : ""
      } ${collapsed ? "page-list-item--collapsed" : ""}`}
      onClick={() => changeSelectedPage(page.id)}
      onContextMenu={onContextMenu}
      data-testid="page-list-item"
      data-page-id={page.id}
      title={page.name}
    >
      <div
        className={`page-list-item__background__indicator ${
          backgroundActive ? "active" : ""
        }`}
      ></div>
      {collapsed ? (
        <span className="page-list-item__initial">{initial}</span>
      ) : (
        <h3>{page.name}</h3>
      )}
    </div>
  );
};
