import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";
import { HeaderSetting } from "../../utils/settings";
import "./index.css";
import Button from "../button";

const HeaderRow = ({
  id,
  headerName,
  headerValue,
  headerEnabled,
  headerType,
  onRemove,
  onUpdate,
  dragHandleProps,
}: HeaderSetting & {
  onRemove: (id: string) => void;
  onUpdate: (
    id: string,
    name: string,
    value: string,
    enabled: boolean,
    type: "request" | "response"
  ) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null | undefined;
}) => {
  const updateName = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(id, e.target.value, headerValue, headerEnabled, headerType);
  };

  const updateValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(id, headerName, e.target.value, headerEnabled, headerType);
  };

  const updateEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(id, headerName, headerValue, e.target.checked, headerType);
  };

  const updateType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate(id, headerName, headerValue, headerEnabled, e.target.value as "request" | "response");
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
      <div className="header-row__type">
        <select
          value={headerType}
          onChange={updateType}
          className="compact-select"
          title={headerType === "request" ? "Request Header" : "Response Header"}
          aria-label="Header type"
        >
          <option value="request">Req</option>
          <option value="response">Res</option>
        </select>
      </div>
      <div className="header-row__remove" onClick={() => onRemove(id)}>
        <Button
          content={<img src="/icons/basket.svg" alt="Remove Header" />}
          style={{ height: "28px", padding: "6px 8px" }}
        />
      </div>
    </div>
  );
};

export default HeaderRow;
