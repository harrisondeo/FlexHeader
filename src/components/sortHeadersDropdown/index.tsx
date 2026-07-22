import { useState, useRef, useEffect } from "react";
import { HeaderSetting } from "../../utils/settings";
import Button from "../button";
import Sort from "../icons/Sort";
import { cx } from "../../utils/cx";
import "./index.css";

type SortField =
  | "headerName"
  | "headerValue"
  | "headerComment"
  | "headerEnabled";
type SortDirection = "asc" | "desc";

const FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: "headerName", label: "Header Name" },
  { value: "headerValue", label: "Header Value" },
  { value: "headerComment", label: "Comment" },
  { value: "headerEnabled", label: "Enabled" },
];

const SortHeadersDropdown = ({
  headers,
  onSort,
}: {
  headers: HeaderSetting[];
  onSort: (sortedHeaders: HeaderSetting[]) => void;
}) => {
  const [show, setShow] = useState(false);
  const [field, setField] = useState<SortField>("headerName");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [buttonLocation, setButtonLocation] = useState<DOMRect | undefined>(
    undefined
  );

  useEffect(() => {
    if (buttonRef.current) {
      setButtonLocation(buttonRef.current.getBoundingClientRect());
    }
  }, [buttonRef, show]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const _handleSort = () => {
    const sorted = [...headers].sort((a, b) => {
      const result =
        field === "headerEnabled"
          ? Number(a.headerEnabled) - Number(b.headerEnabled)
          : a[field].localeCompare(b[field], undefined, {
              sensitivity: "base",
            });
      return direction === "asc" ? result : -result;
    });
    onSort(sorted);
    setShow(false);
  };

  return (
    <>
      <div ref={buttonRef}>
        <Button
          onClick={() => setShow(!show)}
          color="secondary"
          title="Sort headers"
          content={
            <span className="sort-headers-dropdown__toggle-content">
              <Sort className="sort-headers-dropdown__toggle-icon" />
            </span>
          }
          testId="sort-headers-button"
        />
      </div>
      <div
        className={cx("sort-headers-dropdown", { active: show })}
        ref={dropdownRef}
        style={{
          top: (buttonLocation?.bottom || 0) + 5,
          right: (window.innerWidth - (buttonLocation?.right || 0)) as number,
        }}
        data-testid="sort-headers-dropdown"
      >
        <div className="sort-headers-dropdown__item">
          <label htmlFor="sort-headers-field">Sort by</label>
          <select
            id="sort-headers-field"
            value={field}
            onChange={(e) => setField(e.target.value as SortField)}
            data-testid="sort-headers-field"
          >
            {FIELD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sort-headers-dropdown__item">
          <label htmlFor="sort-headers-direction">Order</label>
          <select
            id="sort-headers-direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as SortDirection)}
            data-testid="sort-headers-direction"
          >
            <option value="asc">Ascending (A-Z)</option>
            <option value="desc">Descending (Z-A)</option>
          </select>
        </div>
        <div className="sort-headers-dropdown__actions">
          <Button
            onClick={_handleSort}
            width="full"
            content="Sort"
            testId="sort-headers-apply"
          />
        </div>
      </div>
    </>
  );
};

export default SortHeadersDropdown;
