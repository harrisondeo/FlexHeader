import browser from "webextension-polyfill";
import { ERRORS_STATE_KEY } from "../constants";

export type ErrorCategory = "save" | "apply" | "sync";

export type AppError = {
  id: string;
  category: ErrorCategory;
  message: string;
  details?: string;
  timestamp: number;
};

export type ErrorsState = {
  errors: AppError[];
};

const MAX_STORED_ERRORS = 10;

/**
 * Creates a unique id for an error based on category and timestamp.
 */
function createErrorId(category: ErrorCategory, timestamp: number): string {
  return `${category}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Adds a fake error for manual testing of the error UI.
 * Only exposed in development builds.
 */
export async function injectTestError(category?: ErrorCategory): Promise<void> {
  const targetCategory = category ?? (["save", "apply", "sync"] as ErrorCategory[])[
    Math.floor(Math.random() * 3)
  ];

  const messages: Record<ErrorCategory, string> = {
    save: "Test save error",
    apply: "Test apply error",
    sync: "Test sync error",
  };

  await addStoredError(
    targetCategory,
    messages[targetCategory],
    "This is a manually injected test error used to validate the error reporting UI."
  );
}

/**
 * Reads the current errors from local storage.
 */
export async function getStoredErrors(): Promise<AppError[]> {
  try {
    const result = await browser.storage.local.get(ERRORS_STATE_KEY);
    const state = result[ERRORS_STATE_KEY] as ErrorsState | undefined;
    return state?.errors ?? [];
  } catch (error) {
    console.error("Failed to read errors from storage", error);
    return [];
  }
}

/**
 * Adds a new error to local storage, trimming old errors to keep the list bounded.
 */
export async function addStoredError(
  category: ErrorCategory,
  message: string,
  details?: string
): Promise<void> {
  try {
    const existing = await getStoredErrors();
    const newError: AppError = {
      id: createErrorId(category, Date.now()),
      category,
      message,
      details,
      timestamp: Date.now(),
    };

    const errors = [newError, ...existing].slice(0, MAX_STORED_ERRORS);
    await browser.storage.local.set({ [ERRORS_STATE_KEY]: { errors } });
  } catch (error) {
    console.error("Failed to store error", error);
  }
}

/**
 * Clears all stored errors, optionally filtering by category.
 */
export async function clearStoredErrors(category?: ErrorCategory): Promise<void> {
  try {
    if (!category) {
      await browser.storage.local.remove(ERRORS_STATE_KEY);
      return;
    }

    const existing = await getStoredErrors();
    const errors = existing.filter((error) => error.category !== category);

    if (errors.length === 0) {
      await browser.storage.local.remove(ERRORS_STATE_KEY);
    } else {
      await browser.storage.local.set({ [ERRORS_STATE_KEY]: { errors } });
    }
  } catch (error) {
    console.error("Failed to clear stored errors", error);
  }
}

/**
 * Formats errors into a readable report string suitable for GitHub issues or support.
 */
export function formatErrorReport(errors: AppError[]): string {
  const header = `FlexHeader Error Report\nGenerated: ${new Date().toISOString()}\nErrors: ${errors.length}\n`;
  const body = errors
    .map((error, index) => {
      const time = new Date(error.timestamp).toISOString();
      const details = error.details ? `\nDetails: ${error.details}` : "";
      return `[${index + 1}] ${error.category.toUpperCase()} at ${time}\nMessage: ${error.message}${details}`;
    })
    .join("\n\n");
  return `${header}\n${body}`;
}
