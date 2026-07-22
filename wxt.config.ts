import { defineConfig } from "wxt";

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  srcDir: "src",
  // Group browser builds under dist/<browser> so Chrome's unpacked extension
  // can be loaded from dist/chrome and Firefox is packaged from dist/firefox.
  outDirTemplate: "{{browser}}",
  outDir: "dist",
  // This project has no user data collection; suppress Firefox's new-extension
  // reminder to add data_collection_permissions until it's actually required.
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  manifest: {
    name: "Modify HTTP Headers (HTTP Header) - FlexHeader",
    description:
      "Add, modify & delete HTTP request/response headers with URL & regex rules. Open-source, private, no data collection",
    icons: {
      128: "/logo128.png",
    },
    permissions: ["storage", "declarativeNetRequest"],
    host_permissions: ["<all_urls>"],
    // The popup and options page share the same bundle/UI (see src/App.tsx,
    // which switches layout based on isRunningInActionPopup()).
    action: {
      default_popup: "/app.html",
      default_icon: {
        128: "/logo128.png",
      },
    },
    options_page: "/app.html",
    browser_specific_settings: {
      gecko: {
        id: "flexheaders@harrisondeo.me.uk",
        strict_min_version: "113.0",
      },
    },
  },
});
