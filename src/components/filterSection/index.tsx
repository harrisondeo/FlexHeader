import { HeaderFilter } from "../../utils/settings";
import FilterRow from "../filterRow";
import Info from "../icons/Info";
import "./index.css";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";

const FILTER_SYNTAX_DOCS_URL =
  "https://github.com/harrisondeo/FlexHeader/blob/main/docs/filter-rule-syntax.md";

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
      <div className="filter-section__header">
        Filters ({filters.length})
        <a
          className="filter-section__help-link"
          href={FILTER_SYNTAX_DOCS_URL}
          target="_blank"
          rel="noreferrer"
          data-tooltip="See the URL/Regex filter syntax docs"
          aria-label="Learn how URL and Regex filtering works"
          data-testid="filter-syntax-help-link"
        >
          <Info role="img" aria-label="Filter syntax help" width={14} height={14} />
        </a>
      </div>
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
