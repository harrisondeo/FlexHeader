import { useState } from "react";
import { HeaderSetting } from "../../utils/settings";
import HeaderRow from "../headerRow";
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
  const { saveHeaders } = useSettingsActions();

  const currentPageId = currentPage.id;
  const headers = currentPage.headers;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
      {headers.map((header, index) => (
        <HeaderRow
          key={`header-row__${header.id}`}
          header={header}
          index={index}
          isDragging={draggedIndex === index}
          isDragOver={dragOverIndex === index}
          onDragStart={() => handleDragStart(index)}
          onDragEnter={() => handleDragEnter(index)}
          onDragEnd={handleDragEnd}
          onDrop={() => handleDrop(index)}
        />
      ))}
    </div>
  );
};

export default HeadersList;
