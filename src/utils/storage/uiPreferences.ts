import { PAGES_LIST_COLLAPSED_KEY } from "../../constants";

export const getPagesListCollapsed = (): boolean => {
  try {
    return localStorage.getItem(PAGES_LIST_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
};

export const setPagesListCollapsed = (collapsed: boolean): void => {
  try {
    localStorage.setItem(PAGES_LIST_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Storage failures should not prevent the sidebar from toggling.
  }
};
