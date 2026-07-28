import React from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  return (
    <Card
      onClick={onClick}
      className="relative overflow-hidden group border border-blue-100 bg-white hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer rounded-xl"
    >
      {/* Thin top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-900 via-indigo-800 to-blue-950" />

      <CardHeader className="pb-2 pt-5 px-4 flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-bold text-blue-950 group-hover:text-blue-700 transition-colors pr-4 truncate leading-snug">
            {kpi.name}
          </CardTitle>
          {kpi.description && (
            <CardDescription className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
              {kpi.description}
            </CardDescription>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-blue-300 group-hover:text-blue-600 transition-all shrink-0 group-hover:translate-x-0.5 mt-0.5" />
      </CardHeader>

      <CardContent className="pb-4 px-4">
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            Avg
          </span>
          <span className="text-base font-extrabold text-blue-700 font-mono">
            {value !== undefined && value !== null ? (
              value >= 1000 ? (
                value.toLocaleString(undefined, { maximumFractionDigits: 1 })
              ) : (
                value.toFixed(2)
              )
            ) : (
              <span className="text-xs text-muted-foreground/50 font-normal italic">No Data</span>
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
