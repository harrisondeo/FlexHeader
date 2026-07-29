import type { SVGProps } from "react";

const CircleSlash = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    fillRule="evenodd"
    aria-hidden="true"
    {...props}
  >
    <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4Z" />
    <path d="M5.63 7.05L7.05 5.63L18.37 16.95L16.95 18.37L5.63 7.05Z" />
  </svg>
);

export default CircleSlash;
