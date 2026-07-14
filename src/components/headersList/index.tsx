import { HeaderSetting } from "../../utils/settings";
import HeaderRow from "../headerRow";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import "./index.css";

interface HeadersListProps {
  currentPageId: number;
  headers: HeaderSetting[];
  showComments: boolean;
  removeHeader: (pageId: number, id: string) => void;
  updateHeader: (pageId: number, header: HeaderSetting) => void;
  saveHeaders: (headers: HeaderSetting[], pageId: number) => void;
}

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

const HeadersList = ({
  currentPageId,
  headers,
  showComments,
  removeHeader,
  updateHeader,
  saveHeaders,
}: HeadersListProps) => {
  const handleRemoveHeader = (id: string) => {
    removeHeader(currentPageId, id);
  };

  const handleUpdateHeader = (header: HeaderSetting) => {
    updateHeader(currentPageId, header);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) {
      return;
    }

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
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                    >
                      <HeaderRow
                        key={`header-row__${id}`}
                        id={id}
                        headerName={headerName}
                        headerValue={headerValue}
                        headerComment={headerComment}
                        headerEnabled={headerEnabled}
                        headerType={headerType}
                        showComment={showComments}
                        onRemove={handleRemoveHeader}
                        onUpdate={handleUpdateHeader}
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
