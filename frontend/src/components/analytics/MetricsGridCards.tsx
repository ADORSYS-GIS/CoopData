import { InfoTooltip } from "@/components/ui/info-tooltip";

interface MetricCard {
  label: string;
  value: string | number;
  tooltip: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: string;
}

interface MetricsGridCardsProps {
  metrics: MetricCard[];
  columns?: 2 | 3 | 4;
}

const trendColors = {
  up: "text-success",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

const trendIcons = {
  up: "↗",
  down: "↘",
  neutral: "→",
};

export function MetricsGridCards({ metrics, columns = 4 }: MetricsGridCardsProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-3`}>
      {metrics.map((metric, idx) => (
        <div key={idx} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {metric.label}
            </p>
            <InfoTooltip text={metric.tooltip} />
          </div>
          <p className="mt-2 font-heading text-2xl font-bold tabular-nums text-foreground">
            {metric.value}
          </p>
          {metric.trend && metric.trendValue && (
            <div
              className={`mt-1 flex min-h-5 items-center gap-1 text-xs font-semibold ${trendColors[metric.trend]}`}
            >
              <span>{trendIcons[metric.trend]}</span>
              <span>{metric.trendValue}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
