// Root font-size is unset by default (browser default, 16px), and most of
// the app's CSS sizes text in rem - so scaling the root element's font-size
// scales the whole UI in one place, the same mechanism browser zoom uses.
export const FONT_SIZE_OPTIONS = {
  small: "14px",
  medium: "16px",
  large: "18px",
  xlarge: "20px",
} as const;

export type FontSizePreference = keyof typeof FONT_SIZE_OPTIONS;

export const FONT_SIZE_LABELS: Record<FontSizePreference, string> = {
  small: "Small",
  medium: "Medium (default)",
  large: "Large",
  xlarge: "Extra large",
};

export const DEFAULT_FONT_SIZE: FontSizePreference = "medium";

/** Applies the chosen font size to the document root so it affects every rem-sized element. */
export function applyFontSize(preference: FontSizePreference): void {
  document.documentElement.style.fontSize = FONT_SIZE_OPTIONS[preference];
}
