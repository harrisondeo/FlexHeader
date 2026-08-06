import browser from "webextension-polyfill";
import type { Page } from "../utils/settings";

const COUNT_BADGE_COLOR = "#282828";

let lastBadgeText: string | undefined;
let lastIconPath: string | undefined;

/** Test-only: clears the applied-value cache so each test starts fresh. */
export function resetActionCache(): void {
  lastBadgeText = undefined;
  lastIconPath = undefined;
}

export async function setActionBadge(
  selectedPage: Page | undefined,
  force = false
): Promise<void> {
  const activeHeaderCount = selectedPage?.paused
    ? 0
    : selectedPage?.headers.filter((header) => header.headerEnabled).length ?? 0;
  const text = activeHeaderCount === 0 ? "" : activeHeaderCount.toString();

  if (!force && text === lastBadgeText) {
    return;
  }
  lastBadgeText = text;

  await browser.action.setBadgeText({ text });
  if (text !== "") {
    await browser.action.setBadgeBackgroundColor({ color: COUNT_BADGE_COLOR });
  }
}

const ICON_DEFAULT = "/logo128.png";
const ICON_PAUSED = "/logo128-paused.png";

export async function setActionIcon(paused: boolean, force = false): Promise<void> {
  const path = paused ? ICON_PAUSED : ICON_DEFAULT;
  if (!force && path === lastIconPath) {
    return;
  }
  lastIconPath = path;

  await browser.action.setIcon({ path });
}
