import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_KEYS } from "@/lib/statement-periods";

interface StatementDateSelectProps {
  months: readonly number[];
  value: string;
  year: number;
  onChange: (value: string) => void;
}

/**
 * The "Date" slicer of the statement comparisons, limited to the period ends on
 * offer. When only the year end is on offer, it is shown as just the year.
 */
export function StatementDateSelect({ months, value, year, onChange }: StatementDateSelectProps) {
  const { t } = useTranslation();
  const yearOnly = months.length === 1;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 border border-white/10 min-w-[120px]">
      <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/80 block mb-1">
        {t("analytics.date")}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-white text-slate-900 border-0 h-8 text-xs font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((month) => (
            <SelectItem key={month} value={String(month)} className="text-xs font-medium">
              {yearOnly ? year : `${t(`common.months.${MONTH_KEYS[month - 1]}`)}${year}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
