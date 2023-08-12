import { useState } from "react";
import { Page } from "../../utils/settings";
import "./index.css";

const PageTab = ({
  page,
  active,
  setCurrentPage,
  updatePage,
}: {
  page: Pick<Page, "id" | "name">;
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
        >
          {page.name}
        </div>
      )}
    </>
  );
};

export default PageTab;
