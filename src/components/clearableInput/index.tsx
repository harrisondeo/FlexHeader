import { forwardRef, type InputHTMLAttributes } from "react";
import Clear from "../icons/Clear";
import "./index.css";

type ClearableInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value"
> & {
  value: string | number;
  onClear: () => void;
  wrapperClassName?: string;
};

const ClearableInput = forwardRef<HTMLInputElement, ClearableInputProps>(
  ({ onClear, wrapperClassName = "", value, ...inputProps }, ref) => {
    const hasValue = String(value).length > 0;

    return (
      <span className={`clearable-input ${wrapperClassName}`.trim()}>
        <input ref={ref} value={value} {...inputProps} />
        {hasValue && (
          <button
            type="button"
            className="clearable-input__clear"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClear}
            aria-label="Clear input"
          >
            <Clear className="clearable-input__clear-icon" />
          </button>
        )}
      </span>
    );
  }
);

ClearableInput.displayName = "ClearableInput";

export default ClearableInput;
