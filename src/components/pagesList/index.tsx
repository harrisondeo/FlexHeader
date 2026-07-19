import { useEffect, useState, MouseEventHandler } from "react";
import { Page } from "../../utils/settings";
import Button from "../button";
import PageContextMenu from "../pageContextMenu";
import CollapseArrow from "../icons/CollapseArrow";
import "./index.css";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";

export const PagesList = () => {
  const { pages, currentPage } = useSettingsState();
  const { addPage, changeSelectedPage } = useSettingsActions();
  const [collapsed, setCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    pageId: number;
    x: number;
    y: number;
  } | null>(null);
  const contextMenuPage = pages.find((page) => page.id === contextMenu?.pageId);

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
              <CollapseArrow
                className={`pages-list__collapse-icon ${
                  collapsed ? "" : "pages-list__collapse-icon--expanded"
                }`}
              />
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
          active={page.id === currentPage.id}
          backgroundActive={page.keepEnabled}
          onClick={changeSelectedPage}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({ pageId: page.id, x: event.clientX, y: event.clientY });
          }}
        />
      ))}
      <PageContextMenu
        page={contextMenuPage}
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
  active,
  backgroundActive,
  onClick,
  onContextMenu,
}: {
  page: Page;
  collapsed: boolean;
  active: boolean;
  backgroundActive: boolean;
  onClick: (id: number) => void;
  onContextMenu: MouseEventHandler<HTMLDivElement>;
}) => {
  const initial = page.name.charAt(0).toUpperCase();

  return (
    <div
      className={`page-list-item ${backgroundActive ? "background" : ""} ${
        active ? "active" : ""
      } ${collapsed ? "page-list-item--collapsed" : ""}`}
      onClick={() => onClick(page.id)}
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
