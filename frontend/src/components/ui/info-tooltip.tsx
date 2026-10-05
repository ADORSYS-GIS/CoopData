import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Shared "info icon with explanatory popover" control used throughout the
 * Analytics dashboards. Every chart/stat/grid should have one describing,
 * in specific terms, what the metric measures, where its data comes from
 * (which financial statement account code(s) or non-financial sub-ledger
 * field), and — for ratios — the exact formula. Previously this markup was
 * copy-pasted separately in app-shell.tsx (x2), KpiScorecard.tsx, and
 * MetricsGridCards.tsx; this is the one place it should live now.
 */
export function InfoTooltip({
  text,
  className = "size-3.5",
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 focus:outline-none rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="More information"
        >
          <Info
            className={`${className} text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors shrink-0`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="max-w-xs whitespace-normal z-[60] p-3 shadow-xl">
        <p className="text-sm font-normal normal-case tracking-normal text-foreground leading-snug">
          {text}
        </p>
      </PopoverContent>
    </Popover>
  );
}
