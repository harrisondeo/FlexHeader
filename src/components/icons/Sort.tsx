import type { SVGProps } from "react";

const Sort = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M3 7h11" />
    <path d="M3 12h7" />
    <path d="M3 17h4" />
    <path d="M17 4v16" />
    <path d="M13 16l4 4 4-4" />
  </svg>
);

export default Sort;
