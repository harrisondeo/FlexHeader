import { vi, describe, it, expect, beforeEach } from "vitest";
import type { HeaderSetting, Page } from "../utils/domain/schemas";

const browserMock = vi.hoisted(() => ({
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
    setIcon: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("webextension-polyfill", () => ({
  default: browserMock,
  ...browserMock,
}));

import { setActionBadge, setActionIcon, resetActionCache } from "./icon";

const createHeader = (enabled: boolean): HeaderSetting => ({
  id: `header-${Math.random()}`,
  headerName: "X-Test",
  headerValue: "value",
  headerComment: "",
  headerEnabled: enabled,
  headerType: "request",
});

const createPage = (headers: HeaderSetting[] = [], paused = false): Page => ({
  id: 0,
  name: "Test page",
  enabled: true,
  keepEnabled: false,
  showHeaderComments: true,
  filters: [],
  headers,
  paused,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetActionCache();
});

describe("setActionIcon", () => {
  it("shows the paused icon when paused", async () => {
    await setActionIcon(true);
    expect(browserMock.action.setIcon).toHaveBeenCalledWith({ path: "/logo128-paused.png" });
  });

  it("shows the default icon when not paused", async () => {
    await setActionIcon(false);
    expect(browserMock.action.setIcon).toHaveBeenCalledWith({ path: "/logo128.png" });
  });
});

describe("setActionBadge", () => {
  it("clears the badge when there is no selected page", async () => {
    await setActionBadge(undefined);
    expect(browserMock.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(browserMock.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });

  it("clears the badge when the selected page has no enabled headers", async () => {
    await setActionBadge(createPage([createHeader(false), createHeader(false)]));
    expect(browserMock.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(browserMock.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });

  it("shows the active header count when not paused", async () => {
    await setActionBadge(createPage([createHeader(true), createHeader(true), createHeader(false)]));
    expect(browserMock.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
    expect(browserMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#282828" });
  });

  it("clears the badge when paused, even with enabled headers", async () => {
    await setActionBadge(createPage([createHeader(true), createHeader(true)], true));
    expect(browserMock.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(browserMock.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
  });
});
