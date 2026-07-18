import React from "react";
import ReactDOM from "react-dom/client";
import "../../index.css";
import App from "../../App";

import { ErrorBoundary } from "react-error-boundary";
import ErrorBoundaryFallback from "../../components/errorBoundary";
import { clearStoredSettings } from "../../utils/settings";
import AlertProvider from "../../context/alertContext";
import { SettingsProvider } from "../../context/settingsContext";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <ErrorBoundary
      FallbackComponent={ErrorBoundaryFallback}
      onReset={() => clearStoredSettings()}
    >
      <AlertProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AlertProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
