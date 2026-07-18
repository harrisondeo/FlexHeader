import type { SVGProps } from "react";

const DarkMode = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <rect width="48" height="48" fill="none" />
    <path d="M14,24A10,10,0,0,0,24,34V14A10,10,0,0,0,14,24Z" />
    <path d="M24,2A22,22,0,1,0,46,24,21.9,21.9,0,0,0,24,2ZM6,24A18.1,18.1,0,0,1,24,6v8a10,10,0,0,1,0,20v8A18.1,18.1,0,0,1,6,24Z" />
  </svg>
);

export default DarkMode;
