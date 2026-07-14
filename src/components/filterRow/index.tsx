import { useState } from "react";
import { FilterMode, FilterType, HeaderFilter } from "../../utils/settings";
import Button from "../button";
import "./index.css";

const FilterRow = ({
  id,
  enabled,
  type,
  mode,
  value,
  valid,
  onRemove,
  onUpdate,
}: HeaderFilter & {
  onRemove: (id: string) => void;
  onUpdate: (filter: Omit<HeaderFilter, "valid">) => void;
}) => {
  const [cachedFilterValue, setCachedFilterValue] = useState(value);

  const updateFilter = (patch: Partial<HeaderFilter>) => {
    onUpdate({
      id,
      enabled,
      type,
      mode,
      value,
      ...patch,
    });
  };

  const updateType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type: FilterType = e.target.value as FilterType;
    updateFilter({ type });
  };

  const updateMode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode: FilterMode = e.target.value as FilterMode;
    updateFilter({ mode });
  };

  const updateValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCachedFilterValue(e.target.value);
    updateFilter({ value: e.target.value });
  };

  const updateEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    updateFilter({ enabled: e.target.checked });
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const placeholder = mode === "url" ? "||example.com/" : "^https://example\\.com/.*";

  return (
    <div className="filter-row" data-testid="filter-row">
      <div className="filter-row__checkbox">
        <input type="checkbox" checked={enabled} onChange={updateEnabled} data-testid="filter-enabled" />
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
          style={{ backgroundColor: valid ? "white" : "red" }}
          data-testid="filter-value"
        />
      </div>
      <div className="filter-row__remove" onClick={() => onRemove(id)}>
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
