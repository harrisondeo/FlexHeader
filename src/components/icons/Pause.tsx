import type { SVGProps } from "react";

const Pause = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M8 5C8.55228 5 9 5.44772 9 6V18C9 18.5523 8.55228 19 8 19H6C5.44772 19 5 18.5523 5 18V6C5 5.44772 5.44772 5 6 5H8Z" />
    <path d="M18 5C18.5523 5 19 5.44772 19 6V18C19 18.5523 18.5523 19 18 19H16C15.4477 19 15 18.5523 15 18V6C15 5.44772 15.4477 5 16 5H18Z" />
  </svg>
);

export default Pause;
