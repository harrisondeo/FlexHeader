import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import Button from "../button";
import "./index.css";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";
import { useAlert } from "../../context/alertContext";

const PageTitle = () => {
  const { currentPage } = useSettingsState();
  const { updatePage, changePageIndex } = useSettingsActions();
  const alertContext = useAlert();

  const name = currentPage.name;
  const showHeaderComments = currentPage.showHeaderComments;

  const onRename = (newName: string) => {
    updatePage({ ...currentPage, name: newName });
    alertContext.setAlert({
      alertText: `Page name updated to ${newName}`,
      alertType: "success",
      location: "bottom",
    });
  };

  const onToggleShowHeaderComments = () => {
    updatePage({
      ...currentPage,
      showHeaderComments: !currentPage.showHeaderComments,
    });
  };

  const onMoveLeft = () => changePageIndex(currentPage.id, currentPage.id - 1);
  const onMoveRight = () => changePageIndex(currentPage.id, currentPage.id + 1);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditing(false);
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setValue(name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setValue(name);
      setEditing(false);
    }
  };

  return (
    <div className="page-title">
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="app__page-title app__page-title--input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          data-testid="page-title-input"
        />
      ) : (
        <h2
          className="app__page-title app__page-title--editable"
          onClick={() => setEditing(true)}
          title="Click to rename"
          data-testid="page-title"
        >
          {name}
        </h2>
      )}
      <div className="page-title__actions">
        <Button
          onClick={onToggleShowHeaderComments}
          color={showHeaderComments ? "primary" : "secondary"}
          title={
            showHeaderComments
              ? "Hide the header comments"
              : "Show the header comments"
          }
          content={
            <span className="page-title__toggle-button-content">
              <svg
                className="page-title__toggle-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-3l-5 3v-3H7a3 3 0 0 1-3-3V8z" />
                <path d="M8 10.5h8" />
                <path d="M8 13.5h5.5" />
                <path d="M15 13.5h1.5" />
              </svg>
            </span>
          }
        />
        <Button onClick={onMoveLeft} content="<" testId="page-move-left" />
        <Button onClick={onMoveRight} content=">" testId="page-move-right" />
      </div>
    </div>
  );
};

export default PageTitle;
