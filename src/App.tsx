import "./App.css";
import Divider from "./components/divider";
import Button from "./components/button";
import HeaderRow from "./components/headerRow";
import useFlexHeaderSettings, {
  HeaderFilter,
  HeaderSetting,
  Page,
} from "./utils/settings";
import { useMemo } from "react";
import FilterRow from "./components/filterRow";
import PagesTabs from "./components/pagesTabs";
import Alert from "./components/alert";
import { useAlert } from "./context/alertContext";
import ExportPopup from "./components/exportPopup";
import ImportPopup from "./components/importPopup";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

const reorder = (
  headers: HeaderSetting[],
  startIndex: number,
  endIndex: number
) => {
  const result = Array.from(headers);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

function App() {
  const {
    pages,
    selectedPage,
    darkModeEnabled,
    addHeader,
    saveHeaders,
    updateHeader,
    removeHeader,
    addFilter,
    updateFilter,
    removeFilter,
    addPage,
    updatePage,
    removePage,
    clear,
    changeSelectedPage,
    importSettings,
    changePageIndex,
    toggleDarkMode,
  } = useFlexHeaderSettings();
  const alertContext = useAlert();
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

  const _addPage = async (page?: Page) => {
    console.log(pages);
    const newId = pages.length;

    let newPage: Page = {
      id: newId,
      enabled: true,
      keepEnabled: false,
      name: "New Page",
      headers: [],
      filters: [],
    };

    if (page) {
      newPage = {
        ...page,
        id: newId,
        name: `New Page ${newId}`,
      };
    }

    addPage(newPage);
  };

  const _updatePageName = async (name: string, id: number) => {
    const page = pages.find((x) => x.id === id);

    if (page) {
      page.name = name;
      updatePage(page);
      alertContext.setAlert({
        alertText: `Page name updated to ${name}`,
        alertType: "success",
        location: "bottom",
      });
    }
  };

  const _changePageKeepEnabled = async (id: number, enabled: boolean) => {
    const page = pages.find((x) => x.id === id);

    if (page) {
      page.keepEnabled = enabled;
      updatePage(page);
    }
  };

  const _onDragEnd = (result: any) => {
    if (!result.destination) {
      return;
    }

    const reorderedHeaders = reorder(
      currentPage.headers,
      result.source.index,
      result.destination.index
    );

    saveHeaders(reorderedHeaders, currentPage.id);
  };

  const manifest = chrome.runtime.getManifest();

  return (
    <div className={`app ${darkModeEnabled ? "darkmode" : ""}`}>
      <div className="app__container">
        <div className="app__header">
          <div className="app__header__logo">
            <img
              src="logo128.png"
              alt="FlexHeaders Logo"
              width={50}
              height={50}
            />
            <div>
              <p>Flex Headers</p>
              <span>v{manifest?.version}</span>
              <div>
                A passion project by{" "}
                <a
                  href="https://harrisondeo.me.uk"
                  target="_blank"
                  rel="noreferrer"
                >
                  Harrison Deo
                </a>
              </div>
            </div>
          </div>
          <Button content="New Page" onClick={() => _addPage()} />
          {/* <span onClick={clear}>Clear Settings</span> */}
        </div>
        <PagesTabs
          pages={pages}
          currentPage={currentPage}
          darkModeEnabled={darkModeEnabled}
          setCurrentPage={changeSelectedPage}
          addPage={_addPage}
          updatePageName={_updatePageName}
          updatePageKeepEnabled={_changePageKeepEnabled}
          removePage={removePage}
          changePageIndex={changePageIndex}
          toggleDarkMode={toggleDarkMode}
        />
        <div className="app__body" key={selectedPage}>
          <div>
            {currentPage?.headers?.length === 0 && (
              <p className="app__body__headers__empty">
                <i>No headers found. Add a new header.</i>
              </p>
            )}
            <DragDropContext onDragEnd={_onDragEnd}>
              <Droppable droppableId="droppable-headers">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="app__body__headers"
                  >
                    {currentPage?.headers?.map(
                      (
                        { id, headerName, headerValue, headerEnabled },
                        index
                      ) => (
                        <Draggable key={id} draggableId={id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
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
                            </div>
                          )}
                        </Draggable>
                      )
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
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
          <div className="app__footer__action_block">
            <Button content="Add Header" onClick={_addHeader} />
            <Button content="Add Filter Rule" onClick={_addFilter} />
          </div>
          <div className="app__footer__action_block">
            <ImportPopup importSettings={importSettings} />
            <ExportPopup pages={pages} />
          </div>
        </div>
        <Alert />
      </div>
    </div>
  );
}

export default App;
