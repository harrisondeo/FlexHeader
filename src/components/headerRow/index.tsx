import { HeaderSetting } from "../../utils/settings";
import "./index.css";

const HeaderRow = ({
  id,
  headerName,
  headerValue,
  headerEnabled,
  onRemove,
  onUpdate,
}: HeaderSetting & {
  onRemove: (id: string) => void;
  onUpdate: (id: string, name: string, value: string, enabled: boolean) => void;
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

  return (
    <div className="header-row">
      <div className="header-row__checkbox">
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
          onClick={(e) => e.currentTarget.select()}
        />
      </div>
      <div className="header-row__value">
        <input
          type="text"
          placeholder="Value"
          value={headerValue}
          onChange={updateValue}
          onClick={(e) => e.currentTarget.select()}
        />
      </div>
      <div className="header-row__remove" onClick={() => onRemove(id)}>
        <span>Remove</span>
      </div>
    </div>
  );
};

export default HeaderRow;
