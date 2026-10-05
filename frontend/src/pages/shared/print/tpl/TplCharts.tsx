const TEAL = "#1F4E62";
const LIGHT = "#8FB0BF";
const RED = "#B8392B";
const LINE = "#C9D3D8";
const INK = "#4A5560";

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Rounds up to a round axis maximum such as 300 or 2.5. */
export const niceMax = (value: number): number => {
  if (value <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(value));
  const step = NICE_STEPS.find((candidate) => candidate * base >= value) ?? 10;
  return step * base;
};

export interface PairRow {
  label: string;
  prior: number | null;
  current: number;
}

interface HBarPairsProps {
  rows: PairRow[];
  priorLabel: string;
  currentLabel: string;
  unit: string;
  format?: (value: number) => string;
}

/** Horizontal bars, prior year beneath the current year (template "Figure 1"). */
export function HBarPairs({ rows, priorLabel, currentLabel, unit, format }: HBarPairsProps) {
  const max = niceMax(
    Math.max(...rows.flatMap((r) => [Math.abs(r.prior ?? 0), Math.abs(r.current)]), 1),
  );
  const left = 150;
  const width = 560;
  const rowH = 44;
  const height = rows.length * rowH + 50;
  const x = (value: number) => left + (width * Math.abs(value)) / max;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const fmt = format ?? ((v: number) => String(Math.round(v * 10) / 10));

  return (
    <svg viewBox={`0 0 780 ${height}`} fontFamily="Carlito, sans-serif" fontSize="11" fill={INK}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1="4" y2={rows.length * rowH + 4} stroke="#E3E8EB" />
          <text x={x(tick)} y={rows.length * rowH + 20} textAnchor="middle">
            {fmt(tick)}
          </text>
        </g>
      ))}
      <text x={left + width / 2} y={rows.length * rowH + 38} textAnchor="middle">
        {unit}
      </text>
      {rows.map((row, index) => {
        const top = index * rowH + 8;
        return (
          <g key={row.label}>
            <text x={left - 8} y={top + 16} textAnchor="end">
              {row.label}
            </text>
            <rect x={left} y={top} width={x(row.current) - left} height="14" fill={TEAL} />
            <text x={x(row.current) + 4} y={top + 11}>
              {fmt(row.current)}
            </text>
            {row.prior !== null && (
              <rect x={left} y={top + 16} width={x(row.prior) - left} height="12" fill={LIGHT} />
            )}
          </g>
        );
      })}
      <rect x="590" y={rows.length * rowH - 22} width="12" height="8" fill={LIGHT} />
      <text x="606" y={rows.length * rowH - 14}>
        {priorLabel}
      </text>
      <rect x="660" y={rows.length * rowH - 22} width="12" height="8" fill={TEAL} />
      <text x="676" y={rows.length * rowH - 14}>
        {currentLabel}
      </text>
    </svg>
  );
}

export interface GroupSeries {
  name: string;
  color: string;
}

export interface GroupDatum {
  label: string;
  values: (number | null)[];
}

interface VBarGroupsProps {
  data: GroupDatum[];
  series: GroupSeries[];
  unit: string;
  format?: (value: number) => string;
}

/** Vertical grouped bars with one bar per series in each group. */
export function VBarGroups({ data, series, unit, format }: VBarGroupsProps) {
  const max = niceMax(Math.max(...data.flatMap((d) => d.values.map((v) => Math.abs(v ?? 0))), 1));
  const top = 24;
  const bottom = 190;
  const left = 60;
  const width = 700;
  const slot = width / Math.max(data.length, 1);
  const barW = Math.min(30, (slot - 24) / Math.max(series.length, 1));
  const y = (value: number) => bottom - ((bottom - top) * Math.abs(value)) / max;
  const fmt = format ?? ((v: number) => String(Math.round(v * 10) / 10));

  return (
    <svg viewBox="0 0 780 250" fontFamily="Carlito, sans-serif" fontSize="11" fill={INK}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line
            x1={left}
            x2={left + width}
            y1={y(t * max)}
            y2={y(t * max)}
            stroke={t === 0 ? LINE : "#E3E8EB"}
          />
          <text x={left - 8} y={y(t * max) + 4} textAnchor="end">
            {fmt(t * max)}
          </text>
        </g>
      ))}
      <text
        x="14"
        y={(top + bottom) / 2}
        transform={`rotate(-90 14 ${(top + bottom) / 2})`}
        textAnchor="middle"
      >
        {unit}
      </text>
      {data.map((datum, index) => {
        const start = left + index * slot + (slot - barW * series.length) / 2;
        return (
          <g key={datum.label}>
            {datum.values.map((value, i) =>
              value === null ? null : (
                <g key={series[i]?.name}>
                  <rect
                    x={start + i * barW}
                    y={y(value)}
                    width={barW - 2}
                    height={bottom - y(value)}
                    fill={series[i]?.color}
                  />
                  <text
                    x={start + i * barW + (barW - 2) / 2}
                    y={y(value) - 4}
                    textAnchor="middle"
                    fontSize="10"
                  >
                    {fmt(value)}
                  </text>
                </g>
              ),
            )}
            <text x={left + index * slot + slot / 2} y={bottom + 18} textAnchor="middle">
              {datum.label}
            </text>
          </g>
        );
      })}
      {series.map((item, index) => (
        <g key={item.name}>
          <rect x={left + index * 165} y="4" width="12" height="8" fill={item.color} />
          <text x={left + 16 + index * 165} y="12">
            {item.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

export interface ShareSegment {
  label: string;
  value: number;
}

export interface ShareRow {
  label: string;
  segments: ShareSegment[];
}

const SHADES = [TEAL, "#5E8FA3", LIGHT, "#C5D6DE"];

/** Each row is 100% split into segments (template "Figure 3"). */
export function ShareBars({ rows }: { rows: ShareRow[] }) {
  const left = 90;
  const width = 660;
  const rowH = 46;

  return (
    <svg
      viewBox={`0 0 780 ${rows.length * rowH + 30}`}
      fontFamily="Carlito, sans-serif"
      fontSize="11"
      fill={INK}
    >
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={left + (width * tick) / 100}
            x2={left + (width * tick) / 100}
            y1="0"
            y2={rows.length * rowH}
            stroke="#E3E8EB"
          />
          <text x={left + (width * tick) / 100} y={rows.length * rowH + 16} textAnchor="middle">
            {tick}%
          </text>
        </g>
      ))}
      {rows.map((row, index) => {
        const total = row.segments.reduce((sum, s) => sum + s.value, 0) || 1;
        let cursor = left;
        return (
          <g key={row.label}>
            <text x={left - 8} y={index * rowH + 28} textAnchor="end">
              {row.label}
            </text>
            {row.segments.map((segment, i) => {
              const w = (width * segment.value) / total;
              const start = cursor;
              cursor += w;
              return w > 0 ? (
                <g key={segment.label}>
                  <rect
                    x={start}
                    y={index * rowH + 10}
                    width={w}
                    height="26"
                    fill={SHADES[i % SHADES.length]}
                  />
                  {w > 40 && (
                    <text
                      x={start + w / 2}
                      y={index * rowH + 27}
                      textAnchor="middle"
                      fill={i < 2 ? "#fff" : TEAL}
                      fontSize="10"
                    >
                      {segment.label} {Math.round((segment.value / total) * 100)}%
                    </text>
                  )}
                </g>
              ) : null;
            })}
          </g>
        );
      })}
    </svg>
  );
}

export { TEAL, LIGHT, RED };
