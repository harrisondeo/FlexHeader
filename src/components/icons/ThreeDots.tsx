import type { SVGProps } from "react";

const ThreeDots = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 16 16" fill="#e8eaed" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
  </svg>
);

export default ThreeDots;
