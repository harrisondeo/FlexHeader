import type { SVGProps } from "react";

const CollapseArrow = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M11 19L17 12L11 5" />
    <path d="M7 19L13 12L7 5" />
  </svg>
);

export default CollapseArrow;
