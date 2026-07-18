import { formatRelativeTime } from "./formatRelativeTime";

describe("formatRelativeTime", () => {
  const now = 1_000_000;

  it("returns 'just now' under 10 seconds", () => {
    expect(formatRelativeTime(now - 9_000, now)).toBe("just now");
  });

  it("returns seconds between 10s and 60s", () => {
    expect(formatRelativeTime(now - 45_000, now)).toBe("45s ago");
  });

  it("returns minutes between 60s and 60m", () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
  });

  it("returns hours between 60m and 24h", () => {
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe("3h ago");
  });

  it("returns days at 24h and beyond", () => {
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe("2d ago");
  });

  it("clamps a future timestamp to 'just now' rather than going negative", () => {
    expect(formatRelativeTime(now + 60_000, now)).toBe("just now");
  });

  it("defaults `now` to the current time when omitted", () => {
    const recent = Date.now() - 1_000;
    expect(formatRelativeTime(recent)).toBe("just now");
  });
});
