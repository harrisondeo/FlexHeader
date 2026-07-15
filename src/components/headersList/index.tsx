import { useState } from "react";
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleRemoveHeader = (id: string) => {
    removeHeader(currentPageId, id);
  };

  const handleUpdateHeader = (header: HeaderSetting) => {
    updateHeader(currentPageId, header);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reorderedHeaders = reorder(headers, draggedIndex, targetIndex);
    saveHeaders(reorderedHeaders, currentPageId);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="app__body__headers">
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
            index={index}
            isDragging={draggedIndex === index}
            isDragOver={dragOverIndex === index}
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDrop={() => handleDrop(index)}
          />
        )
      )}
    </div>
  );
};

export default HeadersList;
