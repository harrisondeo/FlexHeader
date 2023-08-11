import { HeaderSetting } from "../../utils/settings";
import "./index.css";

const HeaderRow = ({
  headerName,
  headerValue,
  headerEnabled,
  onRemove,
  onUpdate,
}: HeaderSetting & {
  onRemove: () => void;
  onUpdate: (name: string, value: string, enabled: boolean) => void;
}) => {
  const updateName = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(e.target.value, headerValue, headerEnabled);
  };

  const updateValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(headerName, e.target.value, headerEnabled);
  };

  const updateEnabled = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(headerName, headerValue, e.target.checked);
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
        />
      </div>
      <div className="header-row__value">
        <input
          type="text"
          placeholder="Value"
          value={headerValue}
          onChange={updateValue}
        />
      </div>
      <div className="header-row__remove" onClick={onRemove}>
        <span>Remove</span>
      </div>
    </div>
  );
};

export default HeaderRow;
