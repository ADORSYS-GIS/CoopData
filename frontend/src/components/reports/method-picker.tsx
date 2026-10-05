import { CheckCircle2, FileText } from "lucide-react";

import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import type { ReportMethod } from "@/lib/report-method";

export interface MethodOption {
  id: ReportMethod;
  count: number;
}

interface MethodPickerProps {
  options: MethodOption[];
  value: ReportMethod | "";
  onSelect: (method: ReportMethod) => void;
}

/** Last step of a consolidated export: standard (statements) or questionnaire report. */
export function MethodPicker({ options, value, onSelect }: MethodPickerProps) {
  const { t } = useOrganizationLabelsContext();
  if (options.length === 0) {
    return (
      <div className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-xl p-4 flex items-start gap-2">
        <FileText className="size-4 shrink-0 mt-0.5" />
        <span>{t("reportExport.method.none")}</span>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
        {t("reportExport.method.title")}
      </label>
      <p className="text-xs text-muted-foreground mb-2">
        {options.length === 1 ? t("reportExport.method.auto") : t("reportExport.method.choose")}
      </p>
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all press-feedback ${
              value === option.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border hover:border-accent/40 hover:bg-muted/30"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{t(`reportExport.method.${option.id}`)}</p>
              <p className="text-xs text-muted-foreground">
                {t(`reportExport.method.${option.id}Desc`, { count: option.count })}
              </p>
            </div>
            {value === option.id && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}
