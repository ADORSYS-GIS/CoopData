import React from "react";
import { BarChart3, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

interface CustomKpiItem {
  id: string;
  name: string;
}

interface CoopKpiRow {
  cooperative_id: string;
  name: string;
  region: string | null;
  custom_kpis: Record<string, number>;
}

interface CustomKpiBreakdownTableProps {
  kpis: CustomKpiItem[];
  cooperatives: CoopKpiRow[];
  filteredCooperatives: CoopKpiRow[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}

export const CustomKpiBreakdownTable: React.FC<CustomKpiBreakdownTableProps> = ({
  kpis,
  cooperatives,
  filteredCooperatives,
  searchTerm,
  onSearchChange,
  sortField,
  sortDirection,
  onSort,
}) => {
  const { t } = useTranslation();
  return (
    <Card className="border border-accent/10 bg-white shadow-md overflow-hidden rounded-2xl">
      <CardHeader className="pb-4 border-b border-accent/10 bg-gradient-to-br from-accent/5 to-transparent">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              {t("analytics.coopRankingBreakdown")}
            </CardTitle>
            <CardDescription className="text-xs">{t("analytics.coopRankingDesc")}</CardDescription>
          </div>
          <div className="w-full md:w-72">
            <Input
              placeholder={t("analytics.searchCoopOrRegion")}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="border-accent/20 focus-visible:ring-accent shadow-sm rounded-xl"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-accent/10 text-xs font-bold uppercase tracking-wider text-muted-foreground z-10">
              <tr>
                <th
                  onClick={() => onSort("name")}
                  className="p-4 cursor-pointer hover:bg-accent/10/80 hover:text-accent transition-colors select-none whitespace-nowrap min-w-[240px]"
                >
                  <div className="flex items-center gap-1.5">
                    {t("analytics.coopName")}
                    {sortField === "name" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      ))}
                  </div>
                </th>
                <th
                  onClick={() => onSort("region")}
                  className="p-4 cursor-pointer hover:bg-accent/10/80 hover:text-accent transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    {t("analytics.region")}
                    {sortField === "region" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      ))}
                  </div>
                </th>
                {kpis.map((kpi) => (
                  <th
                    key={kpi.id}
                    onClick={() => onSort(kpi.name)}
                    className="p-4 cursor-pointer hover:bg-accent/10/80 hover:text-accent transition-colors text-right select-none whitespace-nowrap min-w-[150px]"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {kpi.name.replace(/_/g, " ")}
                      {sortField === kpi.name &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        ))}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 bg-white">
              {filteredCooperatives.length === 0 ? (
                <tr>
                  <td
                    colSpan={kpis.length + 2}
                    className="p-8 text-center text-muted-foreground italic"
                  >
                    {t("analytics.noMatchingCoops")}
                  </td>
                </tr>
              ) : (
                filteredCooperatives.map((coop) => (
                  <tr key={coop.cooperative_id} className="hover:bg-accent/10/10 transition-colors">
                    <td className="p-4 font-bold text-foreground">{coop.name}</td>
                    <td className="p-4 text-muted-foreground text-xs">{coop.region || "—"}</td>
                    {kpis.map((kpi) => {
                      const val = coop.custom_kpis?.[kpi.name];
                      const hasVal = val !== undefined && val !== null;
                      return (
                        <td
                          key={kpi.id}
                          className="p-4 text-right font-mono font-bold text-foreground"
                        >
                          {hasVal ? (
                            val >= 1000 ? (
                              val.toLocaleString(undefined, { maximumFractionDigits: 1 })
                            ) : (
                              val.toFixed(2)
                            )
                          ) : (
                            <span className="text-muted-foreground/30 font-normal italic text-xs">
                              {t("analytics.noData")}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
