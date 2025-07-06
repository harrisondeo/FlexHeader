import React, { createContext, useContext, useState } from "react";

export type Alert = {
  alertText: string;
  alertType: "success" | "error" | "warning" | "info";
  location: "top" | "bottom" | "left" | "right";
};

export type AlertContextType = Alert & {
  show: boolean;
  setAlert: (alert: Alert) => void;
};

export const AlertContext = createContext<AlertContextType>({
  alertText: "",
  alertType: "success",
  location: "bottom",
  show: false,
  setAlert: () => { },
});

export const AlertProvider = ({ children }: { children: React.ReactNode }) => {
  const [alert, setAlert] = useState<Alert>({
    alertText: "hello",
    alertType: "success",
    location: "bottom",
  });
  const [show, setShow] = useState(false);

  let timeout: NodeJS.Timeout;

  const updateAlert = (alert: Alert) => {
    clearTimeout(timeout);

    setAlert(alert);
    setShow(true);

    timeout = setTimeout(() => {
      setShow(false);
    }, 5000);
  };

  return (
    <AlertContext.Provider
      value={{
        alertText: alert.alertText,
        alertType: alert.alertType,
        location: alert.location,
        show,
        setAlert: updateAlert,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  return useContext(AlertContext);
};

export default AlertProvider;
