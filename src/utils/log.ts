export type LogLevel = "error" | "warning" | "info";

export const DEFAULT_LOG_LEVEL: LogLevel = "info";

// Severity of a level as a filter threshold - anything more severe than the
// current level is still shown, anything less is suppressed.
const LEVEL_SEVERITY: Record<LogLevel, number> = {
    error: 0,
    warning: 1,
    info: 2,
};

// "success" shares info's verbosity - it's just a differently styled
// completion message, not a distinct severity tier a user would filter by.
const MESSAGE_SEVERITY: Record<"info" | "warning" | "error" | "success", number> = {
    error: 0,
    warning: 1,
    info: 2,
    success: 2,
};

// background.ts and the popup/options UI are separate bundles with their own
// module state, so each context loads the stored preference and calls this
// independently rather than sharing one source of truth.
let currentLogLevel: LogLevel = DEFAULT_LOG_LEVEL;

export const setLogLevel = (level: LogLevel) => {
    currentLogLevel = level;
};

export const log = (
    message: string,
    type: "info" | "warning" | "error" | "success",
    error?: unknown
) => {
    if (MESSAGE_SEVERITY[type] > LEVEL_SEVERITY[currentLogLevel]) {
        return;
    }

    const colorMap: Record<string, string> = {
        info: "color: #1e90ff",
        warning: "color: #ffa500",
        error: "color: #ff4500",
        success: "color: #32cd32",
    };

    // console.error (not .log) so the passed error keeps its expandable
    // stack trace in devtools, while still rendering as one styled line.
    if (error !== undefined) {
        console.error(`%c${message}`, colorMap[type], error);
    } else {
        console.log(`%c${message}`, colorMap[type]);
    }
};
