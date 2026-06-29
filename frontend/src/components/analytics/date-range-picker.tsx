import { useState, useRef, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePreset {
  label: string;
  range: () => DateRange;
}

const PRESETS: DateRangePreset[] = [
  {
    label: "YTD 2025",
    range: () => ({ from: new Date(2025, 0, 1), to: new Date() }),
  },
  {
    label: "Q1 2025",
    range: () => ({ from: new Date(2025, 0, 1), to: new Date(2025, 2, 31) }),
  },
  {
    label: "Q2 2025",
    range: () => ({ from: new Date(2025, 3, 1), to: new Date(2025, 5, 30) }),
  },
  {
    label: "Q3 2025",
    range: () => ({ from: new Date(2025, 6, 1), to: new Date(2025, 8, 30) }),
  },
  {
    label: "Q4 2025",
    range: () => ({ from: new Date(2025, 9, 1), to: new Date(2025, 11, 31) }),
  },
  {
    label: "2024 Full Year",
    range: () => ({ from: new Date(2024, 0, 1), to: new Date(2024, 11, 31) }),
  },
  {
    label: "Last 90 Days",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 90);
      return { from, to };
    },
  },
  {
    label: "Last 30 Days",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return { from, to };
    },
  },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(format(value.from, "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(value.to, "yyyy-MM-dd"));
  const [calendarMonth, setCalendarMonth] = useState<Date>(value.from);
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomFrom(format(value.from, "yyyy-MM-dd"));
    setCustomTo(format(value.to, "yyyy-MM-dd"));
  }, [value]);

  const handlePreset = (preset: DateRangePreset) => {
    const range = preset.range();
    onChange(range);
    setOpen(false);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    if (!value.from || (value.from && value.to && !isAfter(date, value.from))) {
      onChange({ from: startOfDay(date), to: value.to });
      setTimeout(() => toInputRef.current?.focus(), 50);
    } else {
      onChange({ from: value.from, to: endOfDay(date) });
      setOpen(false);
    }
  };

  const handleCustomApply = () => {
    try {
      const from = parseISO(customFrom);
      const to = parseISO(customTo);
      if (isAfter(from, to)) return;
      onChange({ from: startOfDay(from), to: endOfDay(to) });
      setOpen(false);
    } catch {
      // Invalid date format, ignore
    }
  };

  const formatDisplay = (range: DateRange) => {
    const fromStr = format(range.from, "MMM d, yyyy");
    const toStr = format(range.to, "MMM d, yyyy");
    if (fromStr === toStr) return fromStr;
    return `${fromStr} → ${toStr}`;
  };

  const isPresetActive = (preset: DateRangePreset) => {
    const r = preset.range();
    return (
      format(r.from, "yyyy-MM-dd") === format(value.from, "yyyy-MM-dd") &&
      format(r.to, "yyyy-MM-dd") === format(value.to, "yyyy-MM-dd")
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 gap-2 rounded-lg border-border text-sm font-medium"
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className="num">{formatDisplay(value)}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r border-border p-3 w-44">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Quick Select
            </p>
            <div className="space-y-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  className={`w-full text-left rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isPresetActive(preset)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar + custom inputs */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={{ from: value.from, to: value.to }}
              onSelect={(range) => {
                if (range?.from) {
                  onChange({
                    from: startOfDay(range.from),
                    to: range.to ? endOfDay(range.to) : endOfDay(range.from),
                  });
                  if (range.to) {
                    setOpen(false);
                  }
                }
              }}
              numberOfMonths={2}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              defaultMonth={value.from}
            />

            {/* Custom date inputs */}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Custom Range
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">From</label>
                  <input
                    ref={fromInputRef}
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                  />
                </div>
                <span className="text-muted-foreground text-xs mt-4">→</span>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground mb-1 block">To</label>
                  <input
                    ref={toInputRef}
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleCustomApply}
                  className="mt-4 h-7 text-xs"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}