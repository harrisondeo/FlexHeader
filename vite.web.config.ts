import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vite configuration for running the FlexHeader UI as a standalone web app.
 *
 * This is useful for rapid UI iteration: it starts a normal dev server with
 * hot-module replacement and aliases webextension-polyfill to a mock backed
 * by localStorage. Browser-extension-only features (declarativeNetRequest,
 * background service worker, etc.) do not run in this mode.
 */
export default defineConfig({
  plugins: [react()],
  root: "src/web-dev",
  publicDir: "../../public",
  resolve: {
    alias: {
      "webextension-polyfill": path.resolve(
        __dirname,
        "src/web-dev/mockBrowser.ts"
      ),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "dev"),
  },
  server: {
    // Allow Vite to serve source files that live outside src/web-dev (e.g.
    // src/entrypoints/app/main.tsx and src/App.tsx).
    fs: {
      allow: [path.resolve(__dirname, "src")],
    },

    // Force the popup layout by default. Remove the query parameter to view
    // the full-page settings/options layout.
    open: "/?flexheader-popup=1",
  },
});
