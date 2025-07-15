export const log = (message: string, type: "info" | "warning" | "error" | "success") => {
    const colorMap: Record<string, string> = {
        info: "color: #1e90ff",
        warning: "color: #ffa500",
        error: "color: #ff4500",
        success: "color: #32cd32",
    };

    console.log(`%c${message}`, colorMap[type]);
};
