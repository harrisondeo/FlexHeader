// Entry point for the standalone web dev server.
// Renders the same FlexHeader UI; browser APIs are mocked via the
// webextension-polyfill alias configured in vite.web.config.ts.
import React from "react";
import ReactDOM from "react-dom/client";
import "../index.css";
import App from "../App";
import reportWebVitals from "../reportWebVitals";

import { ErrorBoundary } from "react-error-boundary";
import ErrorBoundaryFallback from "../components/errorBoundary";
import { clearStoredSettings } from "../utils/settings";
import AlertProvider from "../context/alertContext";
import { SettingsProvider } from "../context/settingsContext";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
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
);

reportWebVitals();
