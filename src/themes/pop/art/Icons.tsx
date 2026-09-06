import React from "react";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "#000",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  xmlns: "http://www.w3.org/2000/svg",
};

/** scatter + trend line */
export function IconScatter({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 3v18h17" />
      <path d="M7 17l4-5 3 3 5-8" />
      <circle cx="7" cy="17" r="1.4" fill="#000" stroke="none" />
      <circle cx="11" cy="12" r="1.4" fill="#000" stroke="none" />
      <circle cx="14" cy="15" r="1.4" fill="#000" stroke="none" />
      <circle cx="19" cy="7" r="1.4" fill="#000" stroke="none" />
    </svg>
  );
}

/** small neural net */
export function IconNet({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="5" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M6.7 7.1 10.4 10.7M6.7 16.9 10.4 13.3M13.6 10.7 17.3 7.1M13.6 13.3 17.3 16.9" />
    </svg>
  );
}

/** globe / grid */
export function IconGlobe({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3 3.2 3 14.8 0 18-3-3.2-3-14.8 0-18Z" />
    </svg>
  );
}

/** robot head */
export function IconBot({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2v3" />
      <rect x="3.5" y="6" width="17" height="13" rx="3" />
      <circle cx="9" cy="12" r="1.5" fill="#000" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="#000" stroke="none" />
      <path d="M9.5 15.8h5" />
    </svg>
  );
}

/** four-point star for the floating badge */
export function IconStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 0c.9 6.6 4.5 10.4 12 12-7.5 1.6-11.1 5.4-12 12-.9-6.6-4.5-10.4-12-12C7.5 10.4 11.1 6.6 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** plus / minus toggle for the FAQ rows */
export function IconToggle({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="10.5" width="20" height="3" fill="currentColor" />
      {!open && <rect x="10.5" y="2" width="3" height="20" fill="currentColor" />}
    </svg>
  );
}

/** small diamond used inside empty sponsor frames */
export function IconDiamond({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 22 12 12 22 2 12Z" fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}
