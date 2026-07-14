import { HeaderFilter, Page } from "../../utils/settings";
import FilterRow from "../filterRow";
import "./index.css";

interface FilterSectionProps {
  page: Page;
  filters: HeaderFilter[];
  onUpdate: (
    pageId: number,
    filter: Omit<HeaderFilter, "valid">
  ) => void;
  onRemove: (pageId: number, id: string) => void;
  updatePage: (page: Page) => void;
}

const FilterSection = ({
  page,
  filters,
  onUpdate,
  onRemove,
  updatePage,
}: FilterSectionProps) => {
  const onToggle = () => {
    updatePage({ ...page, filtersExpanded: !page.filtersExpanded });
  };

  const handleUpdate = (filter: Omit<HeaderFilter, "valid">) => {
    onUpdate(page.id, filter);
  };

  const handleRemove = (id: string) => {
    onRemove(page.id, id);
  };

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="filter-section">
      <button
        className="filter-section__toggle"
        onClick={onToggle}
        aria-expanded={page.filtersExpanded}
        aria-label={page.filtersExpanded ? "Hide filters" : "Show filters"}
        type="button"
      >
        <span>Filters ({filters.length})</span>
        <span className="filter-section__toggle__icon">
          {page.filtersExpanded ? "▲" : "▼"}
        </span>
      </button>
      {page.filtersExpanded && (
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
      )}
    </div>
  );
};

export default FilterSection;
