import { Page } from "../../utils/settings";
import Button from "../button";
import PageTab from "../pageTab";
import "./index.css";

const PagesTabs = ({
  pages,
  currentPage,
  setCurrentPage,
  addPage,
  removePage,
  updatePage,
}: {
  pages: Pick<Page, "id" | "name">[];
  currentPage: number;
  setCurrentPage: (id: number) => void;
  addPage: () => void;
  removePage: (id: number) => void;
  updatePage: (name: string, id: number) => void;
}) => {
  return (
    <>
      <div className="pages-tabs">
        {pages.map((page) => (
          <PageTab
            key={page.id}
            page={page}
            active={page.id === currentPage}
            setCurrentPage={setCurrentPage}
            updatePage={updatePage}
          />
        ))}
        <div
          key={"page-tab-new"}
          className={`page-tab`}
          onClick={() => addPage()}
        >
          +
        </div>
      </div>
      <div className="pages-tabs__actions">
        <Button
          onClick={() => removePage(currentPage)}
          size="medium"
          text="Remove Page"
        />
      </div>
    </>
  );
};

export default PagesTabs;
