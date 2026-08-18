import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import Button from "../button";
import "./index.css";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";
import { useAlert } from "../../context/alertContext";
import { useSearch } from "../../context/searchContext";
import ArrowDown from "../icons/ArrowDown";
import ArrowUp from "../icons/ArrowUp";
import CircleSlash from "../icons/CircleSlash";
import Close from "../icons/Close";
import CommentToggle from "../icons/CommentToggle";
import Pause from "../icons/Pause";
import Play from "../icons/Play";
import Search from "../icons/Search";
import SortHeadersDropdown from "../sortHeadersDropdown";
import { HeaderSetting } from "../../utils/settings";

const PageTitle = () => {
  const { pages, currentPage } = useSettingsState();
  const { updatePage, changePageIndex, saveHeaders, setAllHeadersEnabled } =
    useSettingsActions();
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

  const anyHeaderEnabled = currentPage.headers.some(
    (header) => header.headerEnabled
  );

  const onToggleAllHeaders = () => {
    setAllHeadersEnabled(currentPage.id, !anyHeaderEnabled);
    alertContext.setAlert({
      alertText: anyHeaderEnabled
        ? "All headers disabled"
        : "All headers enabled",
      alertType: "success",
      location: "bottom",
    });
  };

  const onSort = (sortedHeaders: HeaderSetting[]) => {
    saveHeaders(sortedHeaders, currentPage.id);
  };

  const onMoveUp = () =>
    changePageIndex(currentPage.id, Math.max(0, currentPage.id - 1));
  const onMoveDown = () =>
    changePageIndex(
      currentPage.id,
      Math.min(pages.length - 1, currentPage.id + 1)
    );
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    isOpen: searchOpen,
    query: searchQuery,
    openSearch,
    closeSearch,
    setQuery: setSearchQuery,
  } = useSearch();

  useEffect(() => {
    setEditing(false);
    setValue(name);
  }, [name]);

  const currentPageId = currentPage.id;
  useEffect(() => {
    closeSearch();
  }, [currentPageId]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      closeSearch();
    }
  };

  const onToggleSearch = () => {
    if (searchOpen) {
      closeSearch();
    } else {
      setEditing(false);
      openSearch();
    }
  };

  return (
    <div className="page-title">
      {searchOpen ? (
        <input
          ref={searchInputRef}
          type="text"
          className="app__page-title app__page-title--input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search headers"
          aria-label="Search headers"
          data-testid="page-title-search-input"
        />
      ) : editing ? (
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
          onClick={onToggleSearch}
          color={searchOpen ? "primary" : "secondary"}
          title={searchOpen ? "Close search" : "Search headers"}
          content={
            <span className="page-title__toggle-button-content">
              {searchOpen ? (
                <Close className="page-title__toggle-icon" />
              ) : (
                <Search className="page-title__toggle-icon" />
              )}
            </span>
          }
          testId="toggle-search-textfield"
        />
        <Button
          onClick={onTogglePause}
          color={paused ? "warning" : "secondary"}
          title={paused ? "Resume page" : "Pause page"}
          content={
            <span className="page-title__toggle-button-content">
              {paused ? (
                <Play className="page-title__toggle-icon page-title__toggle-icon--playback" />
              ) : (
                <Pause className="page-title__toggle-icon page-title__toggle-icon--playback" />
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
              <CommentToggle className="page-title__toggle-icon page-title__toggle-icon--comments" />
            </span>
          }
          testId="toggle-header-comments"
        />
        {currentPage.headers.length > 0 && (
          <Button
            onClick={onToggleAllHeaders}
            color={anyHeaderEnabled ? "secondary" : "warning"}
            title={
              anyHeaderEnabled ? "Disable all headers" : "Enable all headers"
            }
            content={
              <span className="page-title__toggle-button-content">
                <CircleSlash className="page-title__toggle-icon page-title__toggle-icon--status" />
              </span>
            }
            testId="toggle-all-headers"
          />
        )}
        <SortHeadersDropdown headers={currentPage.headers} onSort={onSort} />
        <div
          className="page-title__move-group"
          role="group"
          aria-label="Reorder page"
        >
          <Button
            onClick={onMoveUp}
            color="secondary"
            title="Move page up"
            content={
              <span className="page-title__toggle-button-content">
                <ArrowUp className="page-title__toggle-icon page-title__toggle-icon--reorder" />
              </span>
            }
            testId="page-move-up"
          />
          <Button
            onClick={onMoveDown}
            color="secondary"
            title="Move page down"
            content={
              <span className="page-title__toggle-button-content">
                <ArrowDown className="page-title__toggle-icon page-title__toggle-icon--reorder" />
              </span>
            }
            testId="page-move-down"
          />
        </div>
      </div>
    </div>
  );
};

export default PageTitle;
