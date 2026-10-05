interface PieTooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: PieTooltipEntry[];
  /** Sum of all slices, used to show each slice's share. */
  total: number;
  format?: (value: number) => string;
  /** Hide the computed share when the slice value already is a percentage. */
  showPercent?: boolean;
  /** Extra line under the value, read from the slice data. */
  detail?: (slice: Record<string, unknown>) => string | null;
}

const sliceColor = (entry: PieTooltipEntry): string => {
  const data = entry.payload ?? {};
  const fill = data["fill"] ?? data["color"] ?? entry.color;
  return typeof fill === "string" ? fill : "var(--primary)";
};

/**
 * Hover card shared by every donut: colour dot, slice name, its value and its
 * share of the total. Recharts' default tooltip only printed a bare number.
 */
export function PieTooltip({
  active,
  payload,
  total,
  format = (value) => value.toLocaleString(),
  showPercent = true,
  detail,
}: PieTooltipProps) {
  const entry = payload?.[0];
  if (!active || !entry) return null;

  const value = Number(entry.value ?? 0);
  const share = total > 0 ? (value / total) * 100 : 0;
  const extra = detail?.(entry.payload ?? {});

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: sliceColor(entry) }}
        />
        {String(entry.name ?? "")}
      </div>
      <div className="mt-1 font-heading text-sm font-bold tabular-nums text-foreground">
        {format(value)}
        {showPercent && (
          <span className="ml-2 font-sans text-xs font-medium text-muted-foreground">
            {share.toFixed(1)}%
          </span>
        )}
      </div>
      {extra && <div className="mt-0.5 text-muted-foreground">{extra}</div>}
    </div>
  );
}
