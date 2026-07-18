import { useCallback, useEffect, useState } from "react";
import browser from "webextension-polyfill";
import { ERRORS_STATE_KEY } from "../constants";
import { AppError, clearStoredErrors, getStoredErrors, injectTestError, ErrorCategory } from "./errors";

/**
 * Owns the persisted error list surfaced in the errors panel - loading it on
 * mount, staying in sync with local storage writes made elsewhere (the
 * background worker's own save/sync failures), and exposing clear/inject
 * actions. Extracted out of useFlexHeaderSettings so that hook stays focused
 * on page/header state.
 */
function useStoredErrors() {
  const [errors, setErrors] = useState<AppError[]>([]);

  useEffect(() => {
    const loadErrors = async () => {
      const stored = await getStoredErrors();
      setErrors(stored);
    };
    loadErrors();

    const listener = (changes: Record<string, browser.Storage.StorageChange>) => {
      if (ERRORS_STATE_KEY in changes) {
        const newState = changes[ERRORS_STATE_KEY].newValue as { errors: AppError[] } | undefined;
        setErrors(newState?.errors ?? []);
      }
    };

    browser.storage.local.onChanged.addListener(listener);
    return () => browser.storage.local.onChanged.removeListener(listener);
  }, []);

  const clearErrors = useCallback(async (category?: AppError["category"]) => {
    await clearStoredErrors(category);
    const stored = await getStoredErrors();
    setErrors(stored);
  }, []);

  const injectError = useCallback(async (category?: ErrorCategory) => {
    await injectTestError(category);
    const stored = await getStoredErrors();
    setErrors(stored);
  }, []);

  return { errors, clearErrors, injectError };
}

export default useStoredErrors;
