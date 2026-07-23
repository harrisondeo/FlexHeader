import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUiPreference: vi.fn(),
  setUiPreference: vi.fn(),
  addPage: vi.fn(),
  changeSelectedPage: vi.fn(),
}));

vi.mock("../../utils/storage/uiPreferences", () => ({
  getUiPreference: mocks.getUiPreference,
  setUiPreference: mocks.setUiPreference,
}));

vi.mock("../../context/settingsContext", () => ({
  useSettingsState: () => ({
    pages: [
      {
        id: 0,
        name: "Default",
        enabled: true,
        keepEnabled: false,
        paused: false,
        showHeaderComments: true,
        headers: [],
        filters: [],
      },
    ],
    currentPage: { id: 0 },
  }),
  useSettingsActions: () => ({
    addPage: mocks.addPage,
    changeSelectedPage: mocks.changeSelectedPage,
  }),
}));

import { PagesList } from ".";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUiPreference.mockReturnValue(false);
  Element.prototype.scrollIntoView = vi.fn();
});

describe("PagesList collapsed state", () => {
  it("restores the saved state and persists the next toggle", async () => {
    mocks.getUiPreference.mockReturnValue(true);
    const user = userEvent.setup();
    render(<PagesList />);

    expect(screen.getByTestId("pages-list")).toHaveClass(
      "pages-list--collapsed"
    );

    await user.click(screen.getByTestId("toggle-pages-list"));

    expect(screen.getByTestId("pages-list")).not.toHaveClass(
      "pages-list--collapsed"
    );
    expect(mocks.setUiPreference).toHaveBeenCalledWith(
      "pages_list_collapsed",
      false
    );
  });

  it("defaults to an expanded sidebar", () => {
    render(<PagesList />);

    expect(screen.getByTestId("pages-list")).not.toHaveClass(
      "pages-list--collapsed"
    );
  });
});
