import { FilterType, HeaderFilter } from "../../utils/settings";
import "./index.css";

const FilterRow = ({
  id,
  enabled,
  type,
  value,
  valid,
  onRemove,
  onUpdate,
}: HeaderFilter & {
  onRemove: (id: string) => void;
  onUpdate: (filter: Omit<HeaderFilter, "valid">) => void;
}) => {
  const updateType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type: FilterType = e.target.value as FilterType;
    console.log(e.target.value, type);
    onUpdate({ id, enabled, type: type, value });
  };

  const updateValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    onUpdate({ id, enabled, type, value: e.target.value });
  };

  const updateEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    onUpdate({ id, enabled: e.target.checked, type, value });
  };

  return (
    <div className="filter-row">
      <div className="filter-row__checkbox">
        <input type="checkbox" checked={enabled} onChange={updateEnabled} />
      </div>
      <div className="filter-row__type">
        <select value={type} onChange={updateType}>
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
      </div>
      <div className="filter-row__value">
        <input
          type="text"
          placeholder="Value"
          value={value}
          onChange={updateValue}
          style={{ backgroundColor: valid ? "white" : "red" }}
        />
      </div>
      <div className="filter-row__remove" onClick={() => onRemove(id)}>
        <span>Remove</span>
      </div>
    </div>
  );
};

export default FilterRow;
