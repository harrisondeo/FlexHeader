import FilterRow from "../filterRow";
import "./index.css";
import { useSettingsState } from "../../context/settingsContext";

const FilterSection = () => {
  const { currentPage } = useSettingsState();
  const filters = currentPage.filters;

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="filter-section">
      <div className="filter-section__header">Filters ({filters.length})</div>
      <div className="filter-section__container">
        {filters.map((filter) => (
          <FilterRow key={`filter-row__${filter.id}`} filter={filter} />
        ))}
      </div>
    </div>
  );
};

export default FilterSection;
