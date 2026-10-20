import { useState, type PointerEvent } from "react";

const VIEW_W = 300;
const VIEW_H = 100;
/** Daily-style readings (lower y = higher value): a climb, a jump, then a noisy plateau. */
const VALUES = [
  92, 88, 86, 72, 70, 74, 73, 71, 66, 60, 58, 42, 44, 44, 43, 41, 34, 40, 30, 32, 31, 31, 22, 31,
  29, 33, 38, 38, 35, 33, 36,
] as const;
const POINTS = VALUES.map((y, i) => [(i / (VALUES.length - 1)) * VIEW_W, y] as const);
const LINE = POINTS.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
const GRID_ROWS = [25, 50, 75] as const;
/** Where the guide rests when the pointer is away: the jump, as in a market chart's default focus. */
const RESTING_INDEX = 11;

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

/** Decorative market-style chart for the hero panel; the guide follows the pointer on hover. */
export const HeroTrendChart = () => {
  const [active, setActive] = useState(RESTING_INDEX);
  const [x, y] = POINTS[active];

  const followPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    setActive(Math.round(ratio * (POINTS.length - 1)));
  };

  return (
    <div
      aria-hidden="true"
      onPointerMove={followPointer}
      onPointerLeave={() => setActive(RESTING_INDEX)}
      className="relative h-28 text-accent"
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <g className="text-foreground" stroke="currentColor" vectorEffect="non-scaling-stroke">
          {GRID_ROWS.map((row) => (
            <line key={row} x1="0" x2={VIEW_W} y1={row} y2={row} strokeOpacity="0.08" />
          ))}
          <line x1="0" x2={VIEW_W} y1={VIEW_H} y2={VIEW_H} strokeOpacity="0.2" />
        </g>
      </svg>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="animate-wipe absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <linearGradient id="hero-trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${LINE} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`} fill="url(#hero-trend-area)" />
        <path
          d={LINE}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="animate-marker pointer-events-none absolute inset-0">
        <span
          className="absolute bottom-0 border-l border-dashed border-foreground/30 transition-[left,top] duration-150 ease-out"
          style={{ left: pct(x, VIEW_W), top: pct(y, VIEW_H) }}
        />
        <span
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-4 ring-accent/15 transition-[left,top] duration-150 ease-out"
          style={{ left: pct(x, VIEW_W), top: pct(y, VIEW_H) }}
        />
      </div>
    </div>
  );
};
