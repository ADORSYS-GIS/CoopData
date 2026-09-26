import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const PAGE_SIZE = 12;
const EARLIEST_YEAR = 2000;

interface YearPickerFilterProps {
  label: string;
  /** A four-digit year, or `latestValue` for "Latest available". */
  value: string;
  onValueChange: (value: string) => void;
  latestValue: string;
  latestLabel: string;
  currentYear?: number;
}

const pageStartOf = (year: number): number => Math.floor(year / PAGE_SIZE) * PAGE_SIZE;

/**
 * Year filter that opens the same paged year grid used when creating a
 * submission, so any year can be reached without scrolling a long list.
 */
export function YearPickerFilter({
  label,
  value,
  onValueChange,
  latestValue,
  latestLabel,
  currentYear = new Date().getFullYear(),
}: YearPickerFilterProps) {
  const [open, setOpen] = useState(false);
  const selectedYear = value === latestValue ? null : Number(value);
  const [pageStart, setPageStart] = useState(() => pageStartOf(selectedYear ?? currentYear));
  const years = Array.from({ length: PAGE_SIZE }, (_, index) => pageStart + index);

  const choose = (next: string) => {
    onValueChange(next);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold">
      <span className="whitespace-nowrap uppercase text-muted-foreground">{label}:</span>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setPageStart(pageStartOf(selectedYear ?? currentYear));
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex items-center gap-1.5 font-bold outline-none"
          >
            {selectedYear === null ? latestLabel : value}
            <ChevronDown className="size-3.5 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <button
            type="button"
            onClick={() => choose(latestValue)}
            className={`mb-3 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              selectedYear === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-foreground hover:bg-muted/60"
            }`}
          >
            {latestLabel}
            {selectedYear === null && <Check className="size-3.5" />}
          </button>
          <div className="mb-3 flex items-center justify-between px-1">
            <button
              type="button"
              aria-label="Previous years"
              disabled={pageStart <= EARLIEST_YEAR - (EARLIEST_YEAR % PAGE_SIZE)}
              onClick={() => setPageStart((prev) => prev - PAGE_SIZE)}
              className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-bold text-foreground">
              {pageStart} - {pageStart + PAGE_SIZE - 1}
            </span>
            <button
              type="button"
              aria-label="Next years"
              disabled={pageStart + PAGE_SIZE > currentYear}
              onClick={() => setPageStart((prev) => prev + PAGE_SIZE)}
              className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {years.map((year) => {
              const isSelected = year === selectedYear;
              const isOutOfRange = year > currentYear || year < EARLIEST_YEAR;
              return (
                <button
                  key={year}
                  type="button"
                  disabled={isOutOfRange}
                  onClick={() => choose(String(year))}
                  className={`rounded-lg border py-2 text-xs font-bold transition-all ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : isOutOfRange
                        ? "cursor-not-allowed border-transparent text-muted-foreground/30"
                        : "border-border bg-surface text-foreground hover:border-primary/40 hover:bg-muted/60"
                  }`}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
