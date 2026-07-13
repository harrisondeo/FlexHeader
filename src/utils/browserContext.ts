import browser from "webextension-polyfill";

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
    // getBrowserInfo is Firefox-only, so its presence is a reliable signal.
    return typeof runtime.getBrowserInfo === "function";
  } catch {
    return false;
  }
};
