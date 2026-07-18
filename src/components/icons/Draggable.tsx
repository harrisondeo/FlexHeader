import type { SVGProps } from "react";

const Draggable = (
  props: SVGProps<SVGSVGElement> & { draggable?: boolean }
) => (
  <svg fill="#008c26" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="10" y="6" width="4" height="4" />
    <rect x="18" y="6" width="4" height="4" />
    <rect x="10" y="14" width="4" height="4" />
    <rect x="18" y="14" width="4" height="4" />
    <rect x="10" y="22" width="4" height="4" />
    <rect x="18" y="22" width="4" height="4" />
  </svg>
);

export default Draggable;
