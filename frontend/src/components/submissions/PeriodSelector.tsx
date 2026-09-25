import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import type { YearLock } from "@/lib/period-rules";

export type SubmissionPeriodType = "YEARLY" | "QUARTERLY" | "MONTHLY" | "SEMI_ANNUAL";

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Quarter month ranges aligned to a fiscal-year start month (1-12, 1 = Jan). */
export function quarterRanges(startMonth: number): { q: string; label: string }[] {
  const s = (startMonth - 1 + 12) % 12;
  const quarters: { q: string; label: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const m1 = (s + i * 3) % 12;
    const m3 = (s + i * 3 + 2) % 12;
    quarters.push({ q: `Q${i + 1}`, label: `${MONTH_NAMES[m1]}–${MONTH_NAMES[m3]}` });
  }
  return quarters;
}

/** Half-year month ranges aligned to a fiscal-year start month (1-12, 1 = Jan). */
export function halfRanges(startMonth: number): { h: string; label: string }[] {
  const s = (startMonth - 1 + 12) % 12;
  const m1 = s;
  const m2 = (s + 5) % 12;
  const m3 = (s + 6) % 12;
  const m4 = (s + 11) % 12;
  return [
    { h: "H1", label: `${MONTH_NAMES[m1]}–${MONTH_NAMES[m2]}` },
    { h: "H2", label: `${MONTH_NAMES[m3]}–${MONTH_NAMES[m4]}` },
  ];
}

export const FREQUENCY_KEYS = {
  YEARLY: "yearly",
  QUARTERLY: "quarterly",
  MONTHLY: "monthly",
  SEMI_ANNUAL: "semiAnnual",
} as const;

interface PeriodSelectorProps {
  year: number;
  periodType: SubmissionPeriodType;
  periodValue: string;
  fiscalStartMonth: number;
  /** Frequency already fixed for this year, if any. */
  lock: YearLock | null;
  onTypeChange: (type: SubmissionPeriodType) => void;
  onValueChange: (value: string) => void;
  onFiscalStartChange: (month: number) => void;
}

/**
 * Frequency buttons plus the quarter, month or half picker, shared by the
 * cooperative and the apex "new submission" dialogs.
 */
export function PeriodSelector({
  year,
  periodType,
  periodValue,
  fiscalStartMonth,
  lock,
  onTypeChange,
  onValueChange,
  onFiscalStartChange,
}: PeriodSelectorProps) {
  const { t } = useOrganizationLabelsContext();

  return (
    <>
      {/* Period Frequency Selector */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          Reporting Frequency
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["YEARLY", "QUARTERLY", "MONTHLY", "SEMI_ANNUAL"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onTypeChange(type)}
              disabled={lock !== null && lock.periodType !== type}
              className={`rounded-xl py-2 px-3 text-xs font-bold border transition-all text-center disabled:cursor-not-allowed disabled:opacity-40 ${
                periodType === type
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-muted/20 text-foreground hover:bg-muted"
              }`}
            >
              {type === "YEARLY" && "Yearly (Annual)"}
              {type === "QUARTERLY" && "Quarterly"}
              {type === "MONTHLY" && "Monthly (12 Mo.)"}
              {type === "SEMI_ANNUAL" && "Semi-Annual (H1/H2)"}
            </button>
          ))}
        </div>
        {lock && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t(
              lock.onlyDrafts
                ? "periodReminders.lockedFrequencyDrafts"
                : "periodReminders.lockedFrequency",
              {
                year,
                frequency: t(`periodReminders.frequency.${FREQUENCY_KEYS[lock.periodType]}`),
              },
            )}
          </p>
        )}
      </div>

      {/* Fiscal year start month (aligns quarters/halves) */}
      {(periodType === "QUARTERLY" || periodType === "SEMI_ANNUAL") && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Fiscal year starts in
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {MONTH_NAMES.map((m, idx) => (
              <button
                key={m}
                type="button"
                onClick={() => onFiscalStartChange(idx + 1)}
                className={`rounded-lg py-1.5 text-xs font-bold border transition-all ${
                  fiscalStartMonth === idx + 1
                    ? "border-primary bg-primary/10 text-primary border-2"
                    : "border-border bg-surface text-muted-foreground hover:bg-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {periodType === "QUARTERLY"
              ? "Q1 begins in this month; the other quarters follow automatically."
              : "H1 begins in this month; H2 follows automatically."}
          </p>
        </div>
      )}

      {/* Dynamic Period Value Selector */}
      {periodType === "QUARTERLY" && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Select Quarter
          </label>
          <div className="grid grid-cols-4 gap-2">
            {quarterRanges(fiscalStartMonth).map((q) => (
              <button
                key={q.q}
                type="button"
                onClick={() => onValueChange(q.q)}
                className={`rounded-xl py-2 text-xs font-bold border transition-all ${
                  periodValue === q.q
                    ? "border-primary bg-primary/10 text-primary border-2"
                    : "border-border bg-surface text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="block">{q.q}</span>
                <span className="block text-[10px] font-normal text-muted-foreground">
                  {q.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {periodType === "MONTHLY" && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Select Month / Full Year
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { key: "FULL_YEAR", label: "Full 12 Mo" },
              { key: "01", label: "Jan" },
              { key: "02", label: "Feb" },
              { key: "03", label: "Mar" },
              { key: "04", label: "Apr" },
              { key: "05", label: "May" },
              { key: "06", label: "Jun" },
              { key: "07", label: "Jul" },
              { key: "08", label: "Aug" },
              { key: "09", label: "Sep" },
              { key: "10", label: "Oct" },
              { key: "11", label: "Nov" },
              { key: "12", label: "Dec" },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onValueChange(m.key)}
                className={`rounded-lg py-1.5 text-xs font-bold border transition-all ${
                  periodValue === m.key
                    ? "border-primary bg-primary/10 text-primary border-2"
                    : "border-border bg-surface text-muted-foreground hover:bg-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {periodType === "SEMI_ANNUAL" && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Select Half
          </label>
          <div className="grid grid-cols-2 gap-2">
            {halfRanges(fiscalStartMonth).map((h) => (
              <button
                key={h.h}
                type="button"
                onClick={() => onValueChange(h.h)}
                className={`rounded-xl py-2 text-xs font-bold border transition-all ${
                  periodValue === h.h
                    ? "border-primary bg-primary/10 text-primary border-2"
                    : "border-border bg-surface text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="block">{h.h}</span>
                <span className="block text-[10px] font-normal text-muted-foreground">
                  {h.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
