import { useAlert } from "../../context/alertContext";
import "./index.css";
import Check from "../icons/Check";
import ErrorIcon from "../icons/ErrorIcon";
import Warning from "../icons/Warning";
import Info from "../icons/Info";

const Alert = () => {
  const { alertText, alertType, location, show } = useAlert();

  const iconWidth = 28;
  const iconHeight = 28;
  const AlertIcon = () => {
    switch (alertType) {
      case "success":
        return (
          <Check role="img" aria-label="success" width={iconWidth} height={iconHeight} />
        );
      case "error":
        return (
          <ErrorIcon role="img" aria-label="error" width={iconWidth} height={iconHeight} />
        );
      case "warning":
        return (
          <Warning role="img" aria-label="warning" width={iconWidth} height={iconHeight} />
        );

      default:
        return (
          <Info role="img" aria-label="info" width={iconWidth} height={iconHeight} />
        );
    }
  };

  if (!show) return null;

  return (
    <div className={`alert alert-${alertType} alert-${location}`}>
      <AlertIcon />
      {alertText}
    </div>
  );
};

export default Alert;
