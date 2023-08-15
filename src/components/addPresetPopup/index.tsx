import { useEffect, useState } from "react";
import Button from "../button";
import "./index.css";

const AddPresetpopup = ({
  show,
  onSubmit,
}: {
  show: boolean;
  onSubmit: (name: string) => void;
}) => {
  const [name, setName] = useState("");

  const _onSubmit = () => {
    onSubmit(name);
  };

  useEffect(() => {
    if (show) {
      setName("");
    }
  }, [show]);

  if (!show) {
    return null;
  }

  return (
    <div className="add-preset-popup">
      <div className="add-preset-popup__name">
        <input
          type="text"
          placeholder="Preset Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="add-preset-popup__actions">
        <Button text="Add" onClick={_onSubmit} />
      </div>
    </div>
  );
};

export default AddPresetpopup;
