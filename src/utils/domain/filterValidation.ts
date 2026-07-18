import browser from "webextension-polyfill";
import type { HeaderFilter } from "./schemas";

/**
 * Validates a URL pattern (urlFilter) for declarativeNetRequest.
 * urlFilter syntax: '*' wildcard, '|' left/right anchor, '||' domain anchor,
 * '^' separator. Must be non-empty, ASCII only, and use anchors correctly.
 */
export const isValidUrlFilter = (value: string): boolean => {
  if (!value || value.length === 0) return false;

  // ASCII only
  if (/[^\x20-\x7E]/.test(value)) return false;

  // Domain anchor
  if (value.startsWith("||")) {
    if (value === "||*" || value === "||") return false;
    // Optional right anchor: the only other '|' allowed is a single trailing one
    const afterDomain = value.slice(2);
    const trailingPipe = afterDomain.endsWith("|");
    const core = trailingPipe ? afterDomain.slice(0, -1) : afterDomain;
    if (core.length === 0) return false;
    if (core.includes("|")) return false;
    return true;
  }

  // Left and/or right anchors: '|' can only appear at start or end, and must not be the only character
  const pipes = value.split("|").length - 1;
  if (pipes > 2) return false;
  if (pipes === 1) {
    if (value.length === 1) return false;
    if (value[0] !== "|" && value[value.length - 1] !== "|") return false;
  }
  if (pipes === 2 && (value[0] !== "|" || value[value.length - 1] !== "|")) return false;
  return true;
};

export const filterIsValid = async (
  filter: Omit<HeaderFilter, "valid">,
  callback: (valid: boolean) => void
) => {
  if (filter.mode === "url") {
    callback(isValidUrlFilter(filter.value));
    return;
  }

  try {
    browser.declarativeNetRequest
      .isRegexSupported({
        regex: filter.value,
      })
      .then((result) => {
        callback(result.isSupported);
      });
  } catch (error) {
    callback(false);
  }
};
