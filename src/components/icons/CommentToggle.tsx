import type { SVGProps } from "react";

const CommentToggle = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M4 8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-3l-5 3v-3H7a3 3 0 0 1-3-3V8z" />
    <path d="M8 10.5h8" />
    <path d="M8 13.5h5.5" />
    <path d="M15 13.5h1.5" />
  </svg>
);

export default CommentToggle;
