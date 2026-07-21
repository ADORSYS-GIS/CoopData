import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MetricRow {
  label: string;
  value: string | number;
  tooltip: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

interface KpiScorecardProps {
  metrics: MetricRow[];
}

const trendColors = {
  up: "text-success bg-success/10 border-success/20",
  down: "text-destructive bg-destructive/10 border-destructive/20",
  neutral: "text-muted-foreground bg-muted/50 border-border",
};

export function KpiScorecard({ metrics }: KpiScorecardProps) {
  // Split into 3 columns for a dense layout
  const colCount = 3;
  const rowsPerCol = Math.ceil(metrics.length / colCount);

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
        {Array.from({ length: colCount }).map((_, colIndex) => {
          const colMetrics = metrics.slice(colIndex * rowsPerCol, (colIndex + 1) * rowsPerCol);
          return (
            <div key={colIndex} className="flex flex-col divide-y divide-border/50">
              {colMetrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 hover:bg-muted/20 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                      {metric.label}
                    </p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex focus:outline-none rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                          <Info className="size-3 text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors" />
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

                  <div className="flex items-center gap-3">
                    <p className="font-heading text-sm font-bold text-foreground num">
                      {metric.value}
                    </p>
                    {metric.trend && metric.trendValue && (
                      <span
                        className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${trendColors[metric.trend]} w-16 text-center`}
                      >
                        {metric.trendValue}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
