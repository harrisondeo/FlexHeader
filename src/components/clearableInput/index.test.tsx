import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import ClearableInput from ".";

const Example = () => {
  const [value, setValue] = useState("filled");

  return (
    <ClearableInput
      type="text"
      aria-label="Example input"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onClear={() => setValue("")}
    />
  );
};

describe("ClearableInput", () => {
  it("clears a populated input and removes the clear button", async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByRole("button", { name: "Clear input" }));

    expect(
      screen.getByRole("textbox", { name: "Example input" })
    ).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: "Clear input" })
    ).not.toBeInTheDocument();
  });

  it("does not render a clear button for an empty input", () => {
    render(
      <ClearableInput
        type="text"
        value=""
        onChange={() => {}}
        onClear={() => {}}
      />
    );

    expect(screen.queryByRole("button", { name: "Clear input" })).not.toBeInTheDocument();
  });
});
