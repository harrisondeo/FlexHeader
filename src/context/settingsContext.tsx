import React, {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";
import useFlexHeaderSettings, {
  HeaderFilter,
  HeaderSetting,
  Page,
} from "../utils/settings";
import { AppError, ErrorCategory } from "../utils/errors";

type SettingsStateContextValue = {
  pages: Page[];
  selectedPage: number;
  currentPage: Page;
  darkModeEnabled: boolean;
  syncEnabled: boolean;
  lastSyncTime: number | null;
  localModifiedTime: number | null;
  errors: AppError[];
  canUndo: boolean;
  canRedo: boolean;
  historyEnabled: boolean;
};

type SettingsActionsContextValue = {
  addHeader: (
    pageId: number,
    header: Omit<HeaderSetting, "id">
  ) => HeaderSetting | undefined;
  updateHeader: (pageId: number, header: HeaderSetting) => void;
  removeHeader: (pageId: number, id: string) => void;
  saveHeaders: (headers: HeaderSetting[], pageId: number) => void;

  addFilter: (
    pageId: number,
    filter: Omit<HeaderFilter, "id">
  ) => void;
  updateFilter: (
    pageId: number,
    filter: Omit<HeaderFilter, "valid">
  ) => void;
  removeFilter: (pageId: number, id: string) => void;

  addPage: (page: Page) => void;
  updatePage: (page: Page) => void;
  removePage: (id: number, autoSelectPage: boolean) => void;
  changeSelectedPage: (id: number) => void;
  changePageIndex: (oldIndex: number, newIndex: number) => void;

  importSettings: (file: File) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
  toggleSync: () => Promise<void>;
  clearErrors: (category?: AppError["category"]) => Promise<void>;
  injectError: (category?: ErrorCategory) => Promise<void>;
  undo: () => void;
  redo: () => void;
  toggleHistoryEnabled: () => Promise<void>;
};

const SettingsStateContext = createContext<SettingsStateContextValue | null>(
  null
);
const SettingsActionsContext = createContext<SettingsActionsContextValue | null>(
  null
);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const settings = useFlexHeaderSettings();

  const currentPage = useMemo(
    () =>
      settings.pages.find((page) => page.id === settings.selectedPage) ||
      settings.pages[0],
    [settings.pages, settings.selectedPage]
  );

  const state: SettingsStateContextValue = useMemo(
    () => ({
      pages: settings.pages,
      selectedPage: settings.selectedPage,
      currentPage,
      darkModeEnabled: settings.darkModeEnabled,
      syncEnabled: settings.syncEnabled,
      lastSyncTime: settings.lastSyncTime,
      localModifiedTime: settings.localModifiedTime,
      errors: settings.errors,
      canUndo: settings.canUndo,
      canRedo: settings.canRedo,
      historyEnabled: settings.historyEnabled,
    }),
    [
      settings.pages,
      settings.selectedPage,
      currentPage,
      settings.darkModeEnabled,
      settings.syncEnabled,
      settings.lastSyncTime,
      settings.localModifiedTime,
      settings.errors,
      settings.canUndo,
      settings.canRedo,
      settings.historyEnabled,
    ]
  );

  const actions: SettingsActionsContextValue = useMemo(
    () => ({
      addHeader: settings.addHeader,
      updateHeader: settings.updateHeader,
      removeHeader: settings.removeHeader,
      saveHeaders: settings.saveHeaders,
      addFilter: settings.addFilter,
      updateFilter: settings.updateFilter,
      removeFilter: settings.removeFilter,
      addPage: settings.addPage,
      updatePage: settings.updatePage,
      removePage: settings.removePage,
      changeSelectedPage: settings.changeSelectedPage,
      changePageIndex: settings.changePageIndex,
      importSettings: settings.importSettings,
      toggleDarkMode: settings.toggleDarkMode,
      toggleSync: settings.toggleSync,
      clearErrors: settings.clearErrors,
      injectError: settings.injectError,
      undo: settings.undo,
      redo: settings.redo,
      toggleHistoryEnabled: settings.toggleHistoryEnabled,
    }),
    [
      settings.addHeader,
      settings.updateHeader,
      settings.removeHeader,
      settings.saveHeaders,
      settings.addFilter,
      settings.updateFilter,
      settings.removeFilter,
      settings.addPage,
      settings.updatePage,
      settings.removePage,
      settings.changeSelectedPage,
      settings.changePageIndex,
      settings.importSettings,
      settings.toggleDarkMode,
      settings.toggleSync,
      settings.clearErrors,
      settings.injectError,
      settings.undo,
      settings.redo,
      settings.toggleHistoryEnabled,
    ]
  );

  return (
    <SettingsStateContext.Provider value={state}>
      <SettingsActionsContext.Provider value={actions}>
        {children}
      </SettingsActionsContext.Provider>
    </SettingsStateContext.Provider>
  );
};

export const useSettingsState = () => {
  const context = useContext(SettingsStateContext);
  if (!context) {
    throw new Error(
      "useSettingsState must be used within a SettingsProvider"
    );
  }
  return context;
};

export const useSettingsActions = () => {
  const context = useContext(SettingsActionsContext);
  if (!context) {
    throw new Error(
      "useSettingsActions must be used within a SettingsProvider"
    );
  }
  return context;
};
