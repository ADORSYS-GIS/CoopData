import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartRow } from "@/lib/basic-dashboard";

export const PRINT_COLORS = ["#1e3a8a", "#c8a24b", "#10b981", "#6b7280", "#7c3aed"];

export interface PrintSeries {
  key: string;
  name: string;
  color?: string;
  /** Plot on the right-hand axis. */
  secondary?: boolean;
}

interface Props {
  data: ChartRow[];
  bars?: PrintSeries[];
  lines?: PrintSeries[];
  width?: number;
  height?: number;
  formatLeft?: (value: number) => string;
  formatRight?: (value: number) => string;
}

export const PrintComboChart: React.FC<Props> = ({
  data,
  bars = [],
  lines = [],
  width = 640,
  height = 230,
  formatLeft,
  formatRight,
}) => {
  const hasRight = [...bars, ...lines].some((s) => s.secondary);
  return (
    <ComposedChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
      <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
      <YAxis
        yAxisId="left"
        fontSize={10}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatLeft}
      />
      {hasRight && (
        <YAxis
          yAxisId="right"
          orientation="right"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatRight}
        />
      )}
      <Legend wrapperStyle={{ fontSize: 10 }} />
      {bars.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.name}
          yAxisId={s.secondary ? "right" : "left"}
          fill={s.color ?? PRINT_COLORS[i % PRINT_COLORS.length]}
          isAnimationActive={false}
          maxBarSize={38}
        />
      ))}
      {lines.map((s, i) => (
        <Line
          key={s.key}
          dataKey={s.key}
          name={s.name}
          yAxisId={s.secondary ? "right" : "left"}
          stroke={s.color ?? PRINT_COLORS[(i + 2) % PRINT_COLORS.length]}
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
          isAnimationActive={false}
        />
      ))}
    </ComposedChart>
  );
};

export interface PrintSlice {
  name: string;
  value: number;
}

export const PrintDonut: React.FC<{ slices: PrintSlice[]; size?: number }> = ({
  slices,
  size = 200,
}) => (
  <PieChart width={size} height={size}>
    <Pie
      data={slices}
      dataKey="value"
      innerRadius={size * 0.28}
      outerRadius={size * 0.45}
      isAnimationActive={false}
    >
      {slices.map((s, i) => (
        <Cell key={s.name} fill={PRINT_COLORS[i % PRINT_COLORS.length]} />
      ))}
    </Pie>
  </PieChart>
);

export const NoData: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex h-24 items-center justify-center rounded border border-dashed border-slate-200 text-xs text-slate-400">
    {label}
  </div>
);
