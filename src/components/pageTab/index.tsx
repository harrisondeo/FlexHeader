import { useState } from "react";
import { Page } from "../../utils/settings";
import "./index.css";

const PageTab = ({
  page,
  active,
  setCurrentPage,
  updatePage,
}: {
  page: Page;
  active: boolean;
  setCurrentPage: (id: number) => void;
  updatePage: (name: string, id: number) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState(page.name);

  const saveNewTitle = (e: React.FocusEvent<HTMLInputElement>) => {
    setEditing(false);
    if (e.target.value !== editedName) {
      setEditedName(e.target.value);
      updatePage(e.target.value, page.id);
    }
  };

  return (
    <>
      {editing ? (
        <div
          key={page.id}
          className={`page-tab ${active ? "active" : ""}`}
          onClick={() => setCurrentPage(page.id)}
          data-page-id={page.id}
        >
          <input
            type="text"
            autoFocus
            defaultValue={page.name}
            onBlur={saveNewTitle}
          />
        </div>
      ) : (
        <div
          key={page.id}
          className={`page-tab ${active ? "active" : ""}`}
          onClick={() => setCurrentPage(page.id)}
          onDoubleClick={() => setEditing(true)}
          style={{ display: "none" }}
        >
          <img
            className={`page-tab__enabled-image`}
            src={`./icons/${
              page.keepEnabled || page.enabled
                ? "power-active"
                : "power-inactive"
            }.svg`}
            alt="enabled"
            width={16}
            height={16}
          />
          <span>{page.name}</span>
        </div>
      )}
    </>
  );
};

export default PageTab;
