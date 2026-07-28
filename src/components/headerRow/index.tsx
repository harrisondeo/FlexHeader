import { useId, useMemo, useRef, useState } from "react";
import type * as React from "react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { HeaderSetting } from "../../utils/settings";
import { POPULAR_HEADER_NAMES } from "../../constants";
import { cx } from "../../utils/cx";
import Button from "../button";
import "./index.css";
import DraggableIcon from "../icons/Draggable";
import Basket from "../icons/Basket";

const HeaderRow = ({
  id,
  headerName,
  headerValue,
  headerComment,
  headerEnabled,
  headerType,
  onRemove,
  onUpdate,
  showComment,
  isDragging,
  dragHandleProps,
}: HeaderSetting & {
  showComment: boolean;
  onRemove: (id: string) => void;
  onUpdate: (header: HeaderSetting) => void;
  isDragging: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}) => {
  const updateHeader = (patch: Partial<HeaderSetting>) => {
    onUpdate({
      id,
      headerName,
      headerValue,
      headerComment,
      headerEnabled,
      headerType,
      ...patch,
    });
  };

  const updateName = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateHeader({ headerName: e.target.value });
  };

  const updateValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateHeader({ headerValue: e.target.value });
  };

  const updateComment = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateHeader({ headerComment: e.target.value });
  };

  const updateEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateHeader({ headerEnabled: e.target.checked });
  };

  const updateType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateHeader({ headerType: e.target.value as "request" | "response" });
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dropdownId = useId();

  const filteredSuggestions = useMemo(() => {
    const value = headerName.trim().toLowerCase();
    if (!isDropdownOpen || value.length < 2) return [];
    return POPULAR_HEADER_NAMES.filter((name) =>
      name.toLowerCase().includes(value)
    );
  }, [headerName, isDropdownOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateName(e);
    setIsDropdownOpen(true);
  };

  const selectSuggestion = (suggestion: string) => {
    updateHeader({ headerName: suggestion });
    setIsDropdownOpen(false);
    nameInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div
      className={cx("header-row", {
        "header-row--comments-hidden": !showComment,
        "header-row--dragging": isDragging,
        "header-row--disabled": !headerEnabled,
      })}
      data-headerid={id}
      data-testid="header-row"
    >
      <div className="header-row__checkbox">
        <div
          className={cx("draggable-icon-handle", {
            "draggable-icon-handle--dragging": isDragging,
          })}
          aria-label="Reorder header"
          data-testid="header-drag-handle"
          {...dragHandleProps}
        >
          <DraggableIcon aria-hidden="true" className="draggable-icon" />
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={headerEnabled}
            onChange={updateEnabled}
            data-testid="header-enabled"
          />
          <span className="toggle-switch__slider"></span>
        </label>
      </div>
      <div className="header-row__name header-row__name--autocomplete">
        <input
          ref={nameInputRef}
          type="text"
          placeholder="Header"
          value={headerName}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
          aria-autocomplete="list"
          aria-controls={dropdownId}
          aria-expanded={isDropdownOpen && filteredSuggestions.length > 0}
          role="combobox"
          autoComplete="off"
          data-testid="header-name"
        />
        {filteredSuggestions.length > 0 && (
          <ul
            id={dropdownId}
            className="header-row__suggestions"
            role="listbox"
          >
            {filteredSuggestions.map((name) => (
              <li
                key={name}
                role="option"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(name);
                }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="header-row__value">
        <input
          type="text"
          placeholder="Value"
          value={headerValue}
          onChange={updateValue}
          onFocus={handleFocus}
          data-testid="header-value"
        />
      </div>
      {showComment && (
        <div className="header-row__comment">
          <input
            type="text"
            placeholder="Comment"
            value={headerComment}
            onChange={updateComment}
            onFocus={handleFocus}
            data-testid="header-comment"
          />
        </div>
      )}
      <div className="header-row__type">
        <select
          value={headerType}
          onChange={updateType}
          className="compact-select"
          title={headerType === "request" ? "Request Header" : "Response Header"}
          aria-label="Header type"
          data-testid="header-type"
        >
          <option value="request">Req</option>
          <option value="response">Res</option>
        </select>
      </div>
      <div className="header-row__remove" onClick={() => onRemove(id)}>
        <Button
          content={<Basket role="img" aria-label="Remove Header" />}
          style={{ height: "28px", padding: "6px 8px" }}
          testId="header-remove"
        />
      </div>
    </div>
  );
};

export default HeaderRow;
