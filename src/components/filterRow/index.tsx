import { useState } from "react";
import { FilterMode, FilterType, HeaderFilter } from "../../utils/settings";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";
import Button from "../button";
import "./index.css";

const FilterRow = ({ filter }: { filter: HeaderFilter }) => {
  const { currentPage } = useSettingsState();
  const { updateFilter, removeFilter } = useSettingsActions();

  const { id, enabled, type, mode, value, valid } = filter;
  const [cachedFilterValue, setCachedFilterValue] = useState(value);

  const handleUpdateFilter = (patch: Partial<HeaderFilter>) => {
    updateFilter(currentPage.id, { ...filter, ...patch });
  };

  const updateType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type: FilterType = e.target.value as FilterType;
    handleUpdateFilter({ type });
  };

  const updateMode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode: FilterMode = e.target.value as FilterMode;
    handleUpdateFilter({ mode });
  };

  const updateValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCachedFilterValue(e.target.value);
    handleUpdateFilter({ value: e.target.value });
  };

  const updateEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleUpdateFilter({ enabled: e.target.checked });
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const placeholder = mode === "url" ? "||example.com/" : "^https://example\\.com/.*";

  return (
    <div className="filter-row" data-testid="filter-row">
      <div className="filter-row__checkbox">
        <label className="toggle-switch">
          <input type="checkbox" checked={enabled} onChange={updateEnabled} data-testid="filter-enabled" />
          <span className="toggle-switch__slider"></span>
        </label>
      </div>
      <div className="filter-row__type">
        <select value={type} onChange={updateType} data-testid="filter-type">
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
      </div>
      <div className="filter-row__mode">
        <select value={mode} onChange={updateMode} data-testid="filter-mode">
          <option value="url">URL</option>
          <option value="regex">Regex</option>
        </select>
      </div>
      <div className="filter-row__value">
        <input
          type="text"
          placeholder={placeholder}
          value={cachedFilterValue}
          onChange={updateValue}
          onFocus={handleFocus}
          style={
            valid
              ? undefined
              : {
                  borderColor: "var(--color-error)",
                  backgroundColor: "rgba(244, 67, 54, 0.12)",
                }
          }
          data-testid="filter-value"
        />
      </div>
      <div className="filter-row__remove" onClick={() => removeFilter(currentPage.id, id)}>
        <Button
          content={<img src="/icons/basket.svg" alt="Remove Filter" />}
          style={{ height: "28px", padding: "6px 8px" }}
          testId="filter-remove"
        />
      </div>
    </div>
  );
};

export default FilterRow;
