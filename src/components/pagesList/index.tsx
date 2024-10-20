import { useEffect } from "react";
import { Page } from "../../utils/settings";
import "./index.css";

interface PageListProps {
  pages: Page[];
  currentPage: Page;
  setCurrentPage: (id: number) => void;
}

export const PagesList = ({
  pages,
  currentPage,
  setCurrentPage,
}: PageListProps) => {
  useEffect(() => {
    const activePage = document.querySelector(".page-list-item.active");
    //@ts-ignore
    activePage?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [currentPage]);

  return (
    <div className="pages-list">
      {pages.map((page) => (
        <PageListItem
          key={page.id}
          page={page}
          active={page.id === currentPage.id}
          backgroundActive={page.keepEnabled}
          onClick={setCurrentPage}
        />
      ))}
    </div>
  );
};

const PageListItem = ({
  page,
  active,
  backgroundActive,
  onClick,
}: {
  page: Page;
  active: boolean;
  backgroundActive: boolean;
  onClick: (id: number) => void;
}) => {
  return (
    <div
      className={`page-list-item ${backgroundActive ? "background" : ""} ${
        active ? "active" : ""
      }`}
      onClick={() => onClick(page.id)}
    >
      <h3>{page.name}</h3>
      <div
        className={`page-list-item__background__indicator ${
          backgroundActive ? "active" : ""
        }`}
      ></div>
    </div>
  );
};
