import "./App.css";
import Divider from "./components/divider";
import Button from "./components/button";
import HeaderRow from "./components/headerRow";
import useFlexHeaderSettings, {
  HeaderFilter,
  HeaderSetting,
} from "./utils/settings";
import { useEffect, useMemo, useState } from "react";
import FilterRow from "./components/filterRow";

function App() {
  const {
    pages,
    addHeader,
    updateHeader,
    removeHeader,
    addFilter,
    updateFilter,
    removeFilter,
    clear,
  } = useFlexHeaderSettings();
  const [selectedPage, setSelectedPage] = useState(0);
  const currentPage = useMemo(() => pages[selectedPage], [pages, selectedPage]);

  const _addHeader = async () => {
    addHeader(currentPage.id, {
      headerName: "",
      headerValue: "",
      headerEnabled: true,
    });
  };

  const _removeHeader = async (id: string) => {
    removeHeader(currentPage.id, id);
  };

  const _updateHeader = async (header: HeaderSetting) => {
    updateHeader(currentPage.id, header);
  };

  const _addFilter = async () => {
    addFilter(currentPage.id, {
      type: "include",
      value: "new-filter",
      enabled: true,
      valid: false,
    });
  };

  const _updateFilter = async (filter: Omit<HeaderFilter, "valid">) => {
    updateFilter(currentPage.id, filter);
  };

  const _removeFilter = async (id: string) => {
    removeFilter(currentPage.id, id);
  };

  return (
    <div className="app">
      <div className="app__container">
        <div className="app__header">
          <p>Header Mod</p>
          <span onClick={clear}>Clear Settings</span>
        </div>
        <Divider />
        <div className="app__body">
          <div className="app__body__headers">
            {currentPage?.headers?.map(
              ({ id, headerName, headerValue, headerEnabled }) => (
                <HeaderRow
                  key={`header-row__${id}`}
                  id={id}
                  headerName={headerName}
                  headerValue={headerValue}
                  headerEnabled={headerEnabled}
                  onRemove={(id: string) => _removeHeader(id)}
                  onUpdate={(
                    id: string,
                    name: string,
                    value: string,
                    enabled: boolean
                  ) =>
                    _updateHeader({
                      id: id,
                      headerName: name,
                      headerValue: value,
                      headerEnabled: enabled,
                    })
                  }
                />
              )
            )}
          </div>

          {currentPage?.filters?.length > 0 && (
            <div className="app__body__filters">
              <p>Filters</p>
              <div className="app__body__filters__container">
                {currentPage?.filters.map((filter) => (
                  <FilterRow
                    key={`filter-row__${filter.id}`}
                    {...filter}
                    onRemove={_removeFilter}
                    onUpdate={_updateFilter}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <Divider />
        <div className="app__footer">
          <Button text="Add Row" onClick={_addHeader} />
          <Button text="Add Filter" onClick={_addFilter} />
        </div>
        <div>
          {currentPage?.headers?.map((header) => {
            return (
              <div key={header.id}>
                {header.id} - {header.headerName} - {header.headerValue} -{" "}
                {header.headerEnabled ? "Enabled" : "Disabled"}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
