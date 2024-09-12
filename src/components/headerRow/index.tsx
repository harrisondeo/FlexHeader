import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";
import { HeaderSetting } from "../../utils/settings";
import "./index.css";

const HeaderRow = ({
  id,
  headerName,
  headerValue,
  headerEnabled,
  onRemove,
  onUpdate,
  dragHandleProps,
}: HeaderSetting & {
  onRemove: (id: string) => void;
  onUpdate: (id: string, name: string, value: string, enabled: boolean) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null | undefined;
}) => {
  const updateName = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(id, e.target.value, headerValue, headerEnabled);
  };

  const updateValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(id, headerName, e.target.value, headerEnabled);
  };

  const updateEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(id, headerName, headerValue, e.target.checked);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div className="header-row" data-headerId={id}>
      <div className="header-row__checkbox">
        {dragHandleProps && (
          <img
            src="/icons/draggable.svg"
            alt="Draggable"
            className="draggable-icon"
            {...dragHandleProps}
          />
        )}
        <input
          type="checkbox"
          checked={headerEnabled}
          onChange={updateEnabled}
        />
      </div>
      <div className="header-row__name">
        <input
          type="text"
          placeholder="Header"
          value={headerName}
          onChange={updateName}
          onFocus={handleFocus}
        />
      </div>
      <div className="header-row__value">
        <input
          type="text"
          placeholder="Value"
          value={headerValue}
          onChange={updateValue}
          onFocus={handleFocus}
        />
      </div>
      <div className="header-row__remove" onClick={() => onRemove(id)}>
        <span>Remove</span>
      </div>
    </div>
  );
};

export default HeaderRow;
