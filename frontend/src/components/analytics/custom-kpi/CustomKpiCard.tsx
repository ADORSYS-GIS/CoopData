import React from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface CustomKpiItem {
  id: string;
  name: string;
  formula: string;
  description?: string | null;
  created_at: string;
}

interface CustomKpiCardProps {
  kpi: CustomKpiItem;
  value?: number;
  onClick: () => void;
}

export const CustomKpiCard: React.FC<CustomKpiCardProps> = ({ kpi, value, onClick }) => {
  const { t } = useTranslation();
  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden group border border-accent/10 bg-white hover:shadow-md hover:border-accent/30 transition-all duration-200 cursor-pointer rounded-xl"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary to-primary" />

      <CardHeader className="pb-2 pt-5 px-4 flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors pr-4 truncate leading-snug">
            {kpi.name}
          </CardTitle>
          {kpi.description && (
            <CardDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
              {kpi.description}
            </CardDescription>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-accent group-hover:text-accent transition-all shrink-0 group-hover:translate-x-0.5 mt-0.5" />
      </CardHeader>

      <CardContent className="pb-4 px-4">
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            {t("analytics.avg")}
          </span>
          <span className="text-base font-extrabold text-foreground font-mono">
            {value !== undefined && value !== null ? (
              value >= 1000 ? (
                value.toLocaleString(undefined, { maximumFractionDigits: 1 })
              ) : (
                value.toFixed(2)
              )
            ) : (
              <span className="text-xs text-muted-foreground/50 font-normal italic">
                {t("analytics.noData")}
              </span>
            )}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-100 px-2 py-1.5 rounded-lg text-[10px] font-mono text-muted-foreground truncate">
          {kpi.formula}
        </div>
      </CardContent>
    </Card>
  );
};
