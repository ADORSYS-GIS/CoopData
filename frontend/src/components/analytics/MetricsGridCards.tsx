import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{metric.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="font-heading text-2xl font-bold text-foreground num leading-tight">
            {metric.value}
          </p>
          {metric.trend && metric.trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trendColors[metric.trend]}`}>
              <span>{trendIcons[metric.trend]}</span>
              <span>{metric.trendValue}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
