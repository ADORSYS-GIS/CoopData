import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";

interface IndicatorSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function IndicatorSearch({ value, onChange }: IndicatorSearchProps) {
  const { t } = useTranslation();

  return (
    <div className="relative max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("basicDashboard.search.placeholder")}
        aria-label={t("basicDashboard.search.placeholder")}
        className="pl-9 pr-9 shadow-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("basicDashboard.search.clear")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
