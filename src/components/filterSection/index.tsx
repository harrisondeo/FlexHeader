import { HeaderFilter } from "../../utils/settings";
import FilterRow from "../filterRow";
import "./index.css";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";

const FilterSection = () => {
  const { currentPage } = useSettingsState();
  const { updateFilter, removeFilter } = useSettingsActions();

  const filters = currentPage.filters;

  const handleUpdate = (filter: Omit<HeaderFilter, "valid">) => {
    updateFilter(currentPage.id, filter);
  };

  const handleRemove = (id: string) => {
    removeFilter(currentPage.id, id);
  };

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="filter-section">
      <div className="filter-section__header">Filters ({filters.length})</div>
      <div className="filter-section__container">
        {filters.map((filter) => (
          <FilterRow
            key={`filter-row__${filter.id}`}
            {...filter}
            onRemove={handleRemove}
            onUpdate={handleUpdate}
          />
        ))}
      </div>
    </div>
  );
};

export default FilterSection;
