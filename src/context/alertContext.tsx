import React, { createContext, useContext, useRef, useState } from "react";

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

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateAlert = (alert: Alert) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setAlert(alert);
    setShow(true);

    timeoutRef.current = setTimeout(() => {
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
