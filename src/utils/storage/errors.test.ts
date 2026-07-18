import { vi } from "vitest";

const browserMock = vi.hoisted(() => ({
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
}));

vi.mock("webextension-polyfill", () => ({
  default: browserMock,
  ...browserMock,
}));

import { ERRORS_STATE_KEY } from "../../constants";
import {
  addStoredError,
  clearStoredErrors,
  formatErrorReport,
  getStoredErrors,
  injectTestError,
  type AppError,
} from "./errors";

const createArea = () => {
  const store: Record<string, any> = {};
  return {
    store,
    get: vi.fn(async (key: string) => ({ [key]: store[key] })),
    set: vi.fn(async (data: Record<string, any>) => {
      Object.assign(store, data);
    }),
    remove: vi.fn(async (key: string) => {
      delete store[key];
    }),
  };
};

let area: ReturnType<typeof createArea>;

beforeEach(() => {
  vi.clearAllMocks();
  area = createArea();
  browserMock.storage.local.get.mockImplementation(area.get);
  browserMock.storage.local.set.mockImplementation(area.set);
  browserMock.storage.local.remove.mockImplementation(area.remove);
});

describe("getStoredErrors", () => {
  it("returns an empty array when nothing is stored", async () => {
    expect(await getStoredErrors()).toEqual([]);
  });

  it("returns errors from storage", async () => {
    area.store[ERRORS_STATE_KEY] = { errors: [{ id: "1", category: "save", message: "oops", timestamp: 1 }] };
    expect(await getStoredErrors()).toHaveLength(1);
  });

  it("returns an empty array and swallows the error if storage read throws", async () => {
    browserMock.storage.local.get.mockRejectedValueOnce(new Error("boom"));
    expect(await getStoredErrors()).toEqual([]);
  });
});

describe("addStoredError", () => {
  it("prepends a new error so the most recent is first", async () => {
    await addStoredError("save", "first");
    await addStoredError("apply", "second");

    const errors = await getStoredErrors();
    expect(errors[0].message).toBe("second");
    expect(errors[1].message).toBe("first");
  });

  it("trims the list to MAX_STORED_ERRORS (10), dropping the oldest", async () => {
    for (let i = 0; i < 12; i++) {
      await addStoredError("sync", `error-${i}`);
    }

    const errors = await getStoredErrors();
    expect(errors).toHaveLength(10);
    expect(errors[0].message).toBe("error-11");
    expect(errors[9].message).toBe("error-2");
  });

  it("does not throw if the storage write fails", async () => {
    browserMock.storage.local.set.mockRejectedValueOnce(new Error("boom"));
    await expect(addStoredError("save", "oops")).resolves.toBeUndefined();
  });
});

describe("clearStoredErrors", () => {
  it("removes the whole errors key when no category is given", async () => {
    await addStoredError("save", "first");
    await clearStoredErrors();

    expect(await getStoredErrors()).toEqual([]);
    expect(area.remove).toHaveBeenCalledWith(ERRORS_STATE_KEY);
  });

  it("only removes errors matching the given category", async () => {
    await addStoredError("save", "save-error");
    await addStoredError("apply", "apply-error");

    await clearStoredErrors("save");

    const errors = await getStoredErrors();
    expect(errors.map((e) => e.category)).toEqual(["apply"]);
  });

  it("removes the key entirely when filtering leaves nothing", async () => {
    await addStoredError("save", "save-error");

    await clearStoredErrors("save");

    expect(area.remove).toHaveBeenCalledWith(ERRORS_STATE_KEY);
  });
});

describe("injectTestError", () => {
  it("stores an error under the given category", async () => {
    await injectTestError("apply");

    const errors = await getStoredErrors();
    expect(errors[0].category).toBe("apply");
    expect(errors[0].message).toBe("Test apply error");
  });

  it("picks a random category when none is given", async () => {
    await injectTestError();

    const errors = await getStoredErrors();
    expect(["save", "apply", "sync"]).toContain(errors[0].category);
  });
});

describe("formatErrorReport", () => {
  it("includes a header with the error count and each error's details", () => {
    const errors: AppError[] = [
      { id: "1", category: "save", message: "Save failed", details: "stack trace", timestamp: 1_700_000_000_000 },
      { id: "2", category: "sync", message: "Sync failed", timestamp: 1_700_000_100_000 },
    ];

    const report = formatErrorReport(errors);

    expect(report).toContain("Errors: 2");
    expect(report).toContain("[1] SAVE");
    expect(report).toContain("Message: Save failed");
    expect(report).toContain("Details: stack trace");
    expect(report).toContain("[2] SYNC");
    expect(report).toContain("Message: Sync failed");
  });

  it("produces just the header with no error entries for an empty list", () => {
    const report = formatErrorReport([]);
    expect(report).toContain("Errors: 0");
  });
});
