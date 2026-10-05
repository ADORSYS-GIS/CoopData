import { LIGHT, RED, TEAL, niceMax } from "@/pages/shared/print/tpl/TplCharts";

const INK = "#4A5560";
const GRID = "#E3E8EB";
const PALETTE = [TEAL, "#5E8FA3", LIGHT, "#C5D6DE", RED, "#E0A39A", "#7A8B94", "#B9C4CA"];

const roundTo = (value: number, digits = 1): string =>
  String(Math.round(value * 10 ** digits) / 10 ** digits);

export interface DonutSlice {
  label: string;
  value: number;
}

interface DonutProps {
  slices: readonly DonutSlice[];
  /** Formats the value shown beside each legend entry. */
  format?: (value: number) => string;
}

const arcPath = (
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  from: number,
  to: number,
) => {
  const point = (radius: number, angle: number) =>
    `${cx + radius * Math.sin(angle)} ${cy - radius * Math.cos(angle)}`;
  const large = to - from > Math.PI ? 1 : 0;
  return [
    `M ${point(outer, from)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${point(outer, to)}`,
    `L ${point(inner, to)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${point(inner, from)}`,
    "Z",
  ].join(" ");
};

/** Ring chart with a legend that lists each slice, its value and its share. */
export function Donut({ slices, format }: DonutProps) {
  const shown = slices.filter((slice) => slice.value > 0);
  const total = shown.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;
  const fmt = format ?? ((value: number) => roundTo(value));
  let cursor = 0;

  return (
    <svg viewBox="0 0 380 190" fontFamily="Carlito, sans-serif" fontSize="12" fill={INK}>
      {shown.map((slice, index) => {
        const from = cursor;
        cursor += (slice.value / total) * Math.PI * 2;
        const color = PALETTE[index % PALETTE.length];
        return shown.length === 1 ? (
          <g key={slice.label}>
            <circle cx="95" cy="95" r="64" fill="none" stroke={color} strokeWidth="32" />
          </g>
        ) : (
          <path
            key={slice.label}
            d={arcPath(95, 95, 80, 48, from, cursor)}
            fill={color}
            stroke="#fff"
          />
        );
      })}
      {shown.map((slice, index) => (
        <g key={`legend-${slice.label}`} transform={`translate(200 ${20 + index * 25})`}>
          <rect width="11" height="11" y="-9" fill={PALETTE[index % PALETTE.length]} />
          <text x="16" fontSize="12">
            {slice.label}
          </text>
          <text x="16" y="12" fontSize="11">
            {fmt(slice.value)} · {roundTo((slice.value / total) * 100)}%
          </text>
        </g>
      ))}
    </svg>
  );
}

export interface LineLimit {
  value: number;
  label: string;
}

interface LineChartProps {
  labels: readonly string[];
  values: readonly (number | null)[];
  unit: string;
  limit?: LineLimit;
  format?: (value: number) => string;
}

/** Single-series line over periods, with an optional dashed benchmark line. */
export function LineChart({ labels, values, unit, limit, format }: LineChartProps) {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  const fmt = format ?? ((value: number) => roundTo(value));
  const candidates = limit ? [...present, limit.value] : present;
  const rawLow = Math.min(0, ...candidates);
  const rawHigh = Math.max(0, ...candidates);
  const low = rawLow < 0 ? -niceMax(-rawLow) : 0;
  const high = rawHigh > 0 ? niceMax(rawHigh) : 0;
  const span = high - low || 1;
  const left = 44;
  const right = 300;
  const top = 28;
  const bottom = 150;
  const y = (value: number) => bottom - ((value - low) / span) * (bottom - top);
  const step = labels.length > 1 ? (right - left) / (labels.length - 1) : 0;
  const x = (index: number) => (labels.length > 1 ? left + index * step : (left + right) / 2);
  const path = values
    .map((value, index) => (value === null ? null : `${x(index)},${y(value)}`))
    .filter((point): point is string => point !== null)
    .join(" ");

  return (
    <svg viewBox="0 0 380 190" fontFamily="Carlito, sans-serif" fontSize="10" fill={INK}>
      {(low < 0 ? [low, 0, high] : [0, high / 2, high]).map((value) => {
        return (
          <g key={value}>
            <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke={GRID} />
            <text x={left - 6} y={y(value) + 3} textAnchor="end">
              {fmt(value)}
            </text>
          </g>
        );
      })}
      {low < 0 && <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke={INK} />}
      {limit && (
        <g>
          <line
            x1={left}
            x2={right}
            y1={y(limit.value)}
            y2={y(limit.value)}
            stroke={RED}
            strokeDasharray="4 3"
          />
          <text x={right + 4} y={y(limit.value) + 3} fill={RED}>
            {limit.label}
          </text>
        </g>
      )}
      <polyline points={path} fill="none" stroke={TEAL} strokeWidth="2" />
      {values.map((value, index) =>
        value === null ? null : (
          <g key={labels[index]}>
            <circle cx={x(index)} cy={y(value)} r="3" fill={TEAL} />
            <text x={x(index)} y={y(value) - 7} textAnchor="middle">
              {fmt(value)}
            </text>
          </g>
        ),
      )}
      {labels.map((label, index) => (
        <text key={label} x={x(index)} y={bottom + 16} textAnchor="middle">
          {label}
        </text>
      ))}
      <text x={left} y="12">
        {unit}
      </text>
    </svg>
  );
}

interface BarChartProps {
  labels: readonly string[];
  values: readonly number[];
  unit: string;
  format?: (value: number) => string;
}

/** Single-series vertical bars sized for half a page. */
export function BarChart({ labels, values, unit, format }: BarChartProps) {
  const fmt = format ?? ((value: number) => roundTo(value));
  const high = niceMax(Math.max(...values, 1));
  const left = 44;
  const right = 360;
  const top = 28;
  const bottom = 150;
  const slot = (right - left) / Math.max(labels.length, 1);
  const barWidth = Math.min(40, slot - 12);
  const y = (value: number) => bottom - (value / high) * (bottom - top);

  return (
    <svg viewBox="0 0 380 190" fontFamily="Carlito, sans-serif" fontSize="11" fill={INK}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={y(high * t)} y2={y(high * t)} stroke={GRID} />
          <text x={left - 6} y={y(high * t) + 3} textAnchor="end" fontSize="10">
            {fmt(high * t)}
          </text>
        </g>
      ))}
      {values.map((value, index) => {
        const x = left + index * slot + (slot - barWidth) / 2;
        return (
          <g key={labels[index]}>
            <rect x={x} y={y(value)} width={barWidth} height={bottom - y(value)} fill={TEAL} />
            <text x={x + barWidth / 2} y={y(value) - 5} textAnchor="middle">
              {fmt(value)}
            </text>
            <text x={x + barWidth / 2} y={bottom + 16} textAnchor="middle">
              {labels[index]}
            </text>
          </g>
        );
      })}
      <text x={left} y="12" fontSize="10">
        {unit}
      </text>
    </svg>
  );
}
