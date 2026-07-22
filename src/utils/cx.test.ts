import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins truthy strings", () => {
    expect(cx("a", "b", "c")).toBe("a b c");
  });

  it("skips falsy values", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("includes object keys with truthy values", () => {
    expect(cx("base", { active: true, disabled: false })).toBe("base active");
  });

  it("mixes strings and objects", () => {
    expect(cx("a", { b: true }, "c", { d: false })).toBe("a b c");
  });

  it("returns empty string for no args", () => {
    expect(cx()).toBe("");
  });
});
