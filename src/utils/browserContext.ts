import browser from "webextension-polyfill";

/**
 * Detect whether the current window is the extension's action popup.
 *
 * The action popup closes as soon as it loses focus (notably on Firefox when a
 * native file picker opens), so any long-lived operation such as importing or
 * exporting must be moved to a persistent context such as the options page.
 *
 * We use the synchronous browser.extension.getViews API so this check can be
 * performed in render/click paths without racing the popup lifecycle.
 */
export const isRunningInActionPopup = (): boolean => {
  try {
    // getViews is not exposed by webextension-polyfill's types in all MV3
    // builds, but it is supported by Firefox and Chromium for popup windows.
    const views = (browser as any).extension?.getViews?.({ type: "popup" });
    if (!Array.isArray(views)) {
      return false;
    }
    return views.includes(window);
  } catch {
    return false;
  }
};

export const closeActionPopup = (): void => {
  if (isRunningInActionPopup()) {
    window.close();
  }
};

export const isFirefox = (): boolean => {
  try {
    const runtime = browser.runtime as any;
    if (typeof runtime.getBrowserInfo === "function") {
      // getBrowserInfo is Firefox-only.
      return true;
    }
    // Fallback: inspect the manifest's browser_specific_settings gecko id.
    const manifest = runtime.getManifest?.();
    return !!manifest?.browser_specific_settings?.gecko?.id;
  } catch {
    return false;
  }
};
