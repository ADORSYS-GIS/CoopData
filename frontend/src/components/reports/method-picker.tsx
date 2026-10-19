import {
  CheckCircle2,
  Circle,
  ClipboardList,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";

import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import type { MethodCounts, ReportMethod } from "@/lib/report-method";

/** Both editions of a consolidated report, in display order. */
const EDITIONS: { id: ReportMethod; icon: LucideIcon }[] = [
  { id: "standard", icon: FileSpreadsheet },
  { id: "questionnaire", icon: ClipboardList },
];

interface MethodPickerProps {
  /** Approved submissions per edition for the selection made so far. */
  counts: MethodCounts;
  value: ReportMethod | "";
  onSelect: (method: ReportMethod) => void;
  year: string;
}

/**
 * Last step of a consolidated export. Cooperatives report in two ways (financial
 * statements or the questionnaire), so each consolidated report has two editions.
 * Both are always shown so the choice is explicit; one without data is disabled.
 */
export function MethodPicker({ counts, value, onSelect, year }: MethodPickerProps) {
  const { t } = useOrganizationLabelsContext();
  const withData = EDITIONS.filter((e) => counts[e.id] > 0);

  const hint =
    withData.length === 2
      ? t("reportExport.method.choose")
      : withData.length === 1
        ? t("reportExport.method.auto", {
            edition: t(`reportExport.method.${withData[0]?.id}`),
            year,
          })
        : t("reportExport.method.none");

  return (
    <div role="radiogroup" aria-label={t("reportExport.method.title")}>
      <p className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
        {t("reportExport.method.title")}
      </p>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{hint}</p>
      <div className="grid gap-2">
        {EDITIONS.map(({ id, icon: Icon }) => {
          const count = counts[id];
          const available = count > 0;
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!available}
              onClick={() => onSelect(id)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : available
                    ? "border-border hover:border-accent/40 hover:bg-muted/30 press-feedback"
                    : "border-dashed border-border bg-muted/20 opacity-60 cursor-not-allowed"
              }`}
            >
              <div
                className={`size-9 shrink-0 rounded-lg grid place-items-center ${
                  selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {t(`reportExport.method.${id}`)}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      available ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {available
                      ? t("reportExport.method.count", { count })
                      : t("reportExport.method.noneForYear", { year })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {t(`reportExport.method.${id}Desc`)}
                </p>
              </div>
              {selected ? (
                <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
              ) : (
                <Circle
                  className="size-4 shrink-0 text-muted-foreground/40 mt-0.5"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
