const BRANCHES = [
  "M500,300 C430,300 395,100 325,100",
  "M500,300 L325,300",
  "M500,300 C430,300 395,500 325,500",
  "M500,300 C570,300 605,100 675,100",
  "M500,300 L675,300",
  "M500,300 C570,300 605,500 675,500",
] as const;

/** Curved spokes linking the capability hub to each surrounding card. Decorative only. */
export const CapabilityHubLinks = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 1000 600"
    preserveAspectRatio="none"
    className="pointer-events-none absolute inset-0 -z-10 hidden size-full text-accent wipe-from-center lg:block"
  >
    {BRANCHES.map((d) => (
      <path
        key={d}
        d={d}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    ))}
  </svg>
);
