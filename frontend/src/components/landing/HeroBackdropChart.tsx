/** Bar heights (of 400): an uneven climb up to the panel, then shorter bars easing off to the right. */
const BARS = [
  130, 180, 160, 220, 200, 262, 240, 300, 280, 330, 315, 360, 345, 392, 310, 262, 288, 230, 252,
  205,
] as const;
const HIGHLIGHT = 13;
const BAR_W = 26;
const GAP = 16;
const VIEW_W = 4 + BARS.length * (BAR_W + GAP);
const GRID_ROWS = [80, 160, 240, 320] as const;

/** Faint bar chart behind the hero panel, so the line chart in front reads as one panel of a dashboard. */
export const HeroBackdropChart = () => (
  <svg
    aria-hidden="true"
    viewBox={`0 0 ${VIEW_W} 400`}
    preserveAspectRatio="none"
    className="pointer-events-none absolute -bottom-[22%] -left-[22%] -right-[76%] -top-[30%] -z-10 h-[152%] w-[198%] text-accent [mask-image:radial-gradient(ellipse_75%_70%_at_42%_55%,black_55%,transparent_100%)]"
  >
    <g className="text-foreground" stroke="currentColor" strokeOpacity="0.1">
      {GRID_ROWS.map((y) => (
        <line key={y} x1="0" x2={VIEW_W} y1={y} y2={y} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
    {BARS.map((h, i) => (
      <rect
        key={i}
        x={4 + i * (BAR_W + GAP)}
        y={400 - h}
        width={BAR_W}
        height={h}
        rx="3"
        fill="currentColor"
        fillOpacity={i === HIGHLIGHT ? 0.22 : 0.1}
        className="animate-rise"
        style={{ animationDelay: `${200 + i * 50}ms` }}
      />
    ))}
  </svg>
);
