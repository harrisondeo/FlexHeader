import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { HeaderSetting } from "../../utils/settings";
import HeaderRow from "../headerRow";
import "./index.css";
import {
  useSettingsState,
  useSettingsActions,
} from "../../context/settingsContext";

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

const HeadersList = () => {
  const { currentPage } = useSettingsState();
  const { removeHeader, updateHeader, saveHeaders } = useSettingsActions();

  const currentPageId = currentPage.id;
  const headers = currentPage.headers;
  const showComments = currentPage.showHeaderComments;

  const handleRemoveHeader = (id: string) => {
    removeHeader(currentPageId, id);
  };

  const handleUpdateHeader = (header: HeaderSetting) => {
    updateHeader(currentPageId, header);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const reorderedHeaders = reorder(
      headers,
      result.source.index,
      result.destination.index
    );

    saveHeaders(reorderedHeaders, currentPageId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="droppable-headers">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="app__body__headers"
          >
            {headers.map(
              (
                {
                  id,
                  headerName,
                  headerValue,
                  headerComment,
                  headerEnabled,
                  headerType,
                },
                index
              ) => (
                <Draggable key={id} draggableId={id} index={index}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.draggableProps}>
                      <HeaderRow
                        id={id}
                        headerName={headerName}
                        headerValue={headerValue}
                        headerComment={headerComment}
                        headerEnabled={headerEnabled}
                        headerType={headerType}
                        showComment={showComments}
                        onRemove={handleRemoveHeader}
                        onUpdate={handleUpdateHeader}
                        isDragging={snapshot.isDragging}
                        dragHandleProps={provided.dragHandleProps}
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
  );
};

export default HeadersList;
