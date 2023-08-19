import "./App.css";
import Divider from "./components/divider";
import Button from "./components/button";
import HeaderRow from "./components/headerRow";
import useFlexHeaderSettings, {
  HeaderFilter,
  HeaderSetting,
} from "./utils/settings";
import { useMemo } from "react";
import FilterRow from "./components/filterRow";
import PagesTabs from "./components/pagesTabs";
import { ErrorBoundary } from "react-error-boundary";

function App() {
  const {
    pages,
    addHeader,
    updateHeader,
    removeHeader,
    addFilter,
    updateFilter,
    removeFilter,
    addPage,
    updatePage,
    removePage,
    clear,
    selectedPage,
    changeSelectedPage,
    addPreset,
    getPresetsJSON,
  } = useFlexHeaderSettings();
  const currentPage = useMemo(
    () => pages.find((x) => x.id === selectedPage) || pages[0],
    [pages, selectedPage]
  );

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
      value: "http*",
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

  const _addPage = async () => {
    const newId = pages.length;
    addPage({
      id: newId,
      enabled: true,
      keepEnabled: false,
      name: "New Page",
      headers: [],
      filters: [],
    });
  };

  const _updatePageName = async (name: string, id: number) => {
    const page = pages.find((x) => x.id === id);

    if (page) {
      page.name = name;
      updatePage(page);
    }
  };

  const _changePageKeepEnabled = async (id: number, enabled: boolean) => {
    const page = pages.find((x) => x.id === id);

    if (page) {
      page.keepEnabled = enabled;
      updatePage(page);
    }
  };

  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <div className="app">
        <div className="app__container">
          <div className="app__header">
            <div className="app__header__logo">
              <img
                src="logo128.png"
                alt="FlexHeaders Logo"
                width={50}
                height={50}
              />
              <p>Flex Headers</p>
            </div>
            {/* <span onClick={clear}>Clear Settings</span> */}
          </div>
          <PagesTabs
            pages={pages}
            currentPage={currentPage}
            setCurrentPage={changeSelectedPage}
            addPage={_addPage}
            updatePageName={_updatePageName}
            updatePageKeepEnabled={_changePageKeepEnabled}
            removePage={removePage}
            addNewPreset={addPreset}
          />
          <div className="app__body">
            <div className="app__body__headers">
              {currentPage?.headers?.length === 0 && (
                <p className="app__body__headers__empty">
                  <i>No headers found. Add a new header.</i>
                </p>
              )}
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
            <Button content="Add Header" onClick={_addHeader} />
            <Button content="Add Filter Rule" onClick={_addFilter} />
            <Button
              content="Get Presets"
              onClick={() => {
                console.log(getPresetsJSON());
              }}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
