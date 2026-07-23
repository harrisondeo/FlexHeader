import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import Button from "../button";
import "./index.css";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";
import { useAlert } from "../../context/alertContext";
import CommentToggle from "../icons/CommentToggle";
import Pause from "../icons/Pause";
import Play from "../icons/Play";
import SortHeadersDropdown from "../sortHeadersDropdown";
import { HeaderSetting } from "../../utils/settings";

const PageTitle = () => {
  const { pages, currentPage } = useSettingsState();
  const { updatePage, changePageIndex, saveHeaders } = useSettingsActions();
  const alertContext = useAlert();

  const name = currentPage.name;
  const showHeaderComments = currentPage.showHeaderComments;
  const paused = !!currentPage.paused;

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

  const onTogglePause = () => {
    updatePage({ ...currentPage, paused: !currentPage.paused });
  };

  const onSort = (sortedHeaders: HeaderSetting[]) => {
    saveHeaders(sortedHeaders, currentPage.id);
  };

  const onMoveLeft = () =>
    changePageIndex(currentPage.id, Math.max(0, currentPage.id - 1));
  const onMoveRight = () =>
    changePageIndex(
      currentPage.id,
      Math.min(pages.length - 1, currentPage.id + 1)
    );
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
          onClick={onTogglePause}
          color={paused ? "warning" : "secondary"}
          title={paused ? "Resume page" : "Pause page"}
          content={
            <span className="page-title__toggle-button-content">
              {paused ? (
                <Play className="page-title__toggle-icon" />
              ) : (
                <Pause className="page-title__toggle-icon" />
              )}
            </span>
          }
          testId="toggle-page-pause"
        />
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
              <CommentToggle className="page-title__toggle-icon" />
            </span>
          }
          testId="toggle-header-comments"
        />
        <SortHeadersDropdown headers={currentPage.headers} onSort={onSort} />
        <Button onClick={onMoveLeft} content="<" testId="page-move-left" />
        <Button onClick={onMoveRight} content=">" testId="page-move-right" />
      </div>
    </div>
  );
};

export default PageTitle;
