import browser from "webextension-polyfill";

export const isRunningInActionPopup = (): boolean => {
  try {
    // Allow tests to force popup mode by navigating to
    // chrome-extension://<id>/index.html?flexheader-popup=1. This lets
    // Playwright open the popup UI in a normal tab while keeping production
    // behaviour unchanged.
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location?.search ?? "").get("flexheader-popup") === "1"
    ) {
      return true;
    }

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

export const openOptionsPageAndClosePopup = async (): Promise<void> => {
  try {
    await browser.runtime.openOptionsPage();
    closeActionPopup();
  } catch (error) {
    console.error("Failed to open settings page:", error);
  }
};
