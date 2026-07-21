import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {metrics.map((metric, idx) => (
        <div
          key={idx}
          className="relative rounded-xl border border-border bg-surface p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {metric.label}
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex focus:outline-none rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Info className="size-3.5 text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                className="max-w-xs whitespace-normal z-[60] p-3 shadow-xl"
              >
                <p className="text-sm font-normal normal-case tracking-normal text-foreground leading-snug">
                  {metric.tooltip}
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <p className="font-heading text-2xl font-bold text-foreground num leading-tight">
            {metric.value}
          </p>
          {metric.trend && metric.trendValue && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trendColors[metric.trend]}`}
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
