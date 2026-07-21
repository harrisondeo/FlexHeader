import type { SVGProps } from "react";

const Play = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M7 5.6C7 4.72 7.96 4.18 8.72 4.63L18.16 10.23C18.9 10.67 18.9 11.73 18.16 12.17L8.72 17.77C7.96 18.22 7 17.68 7 16.8V5.6Z" />
  </svg>
);

export default Play;
