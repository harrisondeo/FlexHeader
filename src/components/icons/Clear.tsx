import type { SVGProps } from "react";

const Clear = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M5.25 5.25 14.75 14.75M14.75 5.25 5.25 14.75" />
  </svg>
);

export default Clear;
