import { DraggableProvidedDragHandleProps } from "react-beautiful-dnd";
import { HeaderSetting } from "../../utils/settings";
import "./index.css";
import Button from "../button";

const HeaderRow = ({
  id,
  headerName,
  headerValue,
  headerComment,
  headerEnabled,
  headerType,
  onRemove,
  onUpdate,
  dragHandleProps,
  showComment,
}: HeaderSetting & {
  showComment: boolean;
  onRemove: (id: string) => void;
  onUpdate: (header: HeaderSetting) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null | undefined;
}) => {
  const updateHeader = (patch: Partial<HeaderSetting>) => {
    onUpdate({
      id,
      headerName,
      headerValue,
      headerComment,
      headerEnabled,
      headerType,
      ...patch,
    });
  };

  const updateName = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateHeader({ headerName: e.target.value });
  };

  const updateValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateHeader({ headerValue: e.target.value });
  };

  const updateComment = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateHeader({ headerComment: e.target.value });
  };

  const updateEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateHeader({ headerEnabled: e.target.checked });
  };

  const updateType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateHeader({ headerType: e.target.value as "request" | "response" });
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  return (
    <div className={`header-row${showComment ? "" : " header-row--comments-hidden"}`} data-headerId={id}>
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
      {showComment && (
        <div className="header-row__comment">
          <input
            type="text"
            placeholder="Comment"
            value={headerComment}
            onChange={updateComment}
            onFocus={handleFocus}
          />
        </div>
      )}
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
