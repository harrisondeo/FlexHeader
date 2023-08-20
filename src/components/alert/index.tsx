import { useAlert } from "../../context/alertContext";
import "./index.css";

const Alert = () => {
  const { alertText, alertType, location, show } = useAlert();

  const iconWidth = 28;
  const iconHeight = 28;
  const AlertIcon = () => {
    switch (alertType) {
      case "success":
        return (
          <img
            src="icons/check.svg"
            alt="success"
            width={iconWidth}
            height={iconHeight}
          />
        );
      case "error":
        return (
          <img
            src="icons/error.svg"
            alt="error"
            width={iconWidth}
            height={iconHeight}
          />
        );
      case "warning":
        return (
          <img
            src="icons/warning.svg"
            alt="warning"
            width={iconWidth}
            height={iconHeight}
          />
        );

      default:
        return (
          <img
            src="icons/info.svg"
            alt="info"
            width={iconWidth}
            height={iconHeight}
          />
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
