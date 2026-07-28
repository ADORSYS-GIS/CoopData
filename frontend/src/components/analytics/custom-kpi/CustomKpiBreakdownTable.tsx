import React from "react";
import { BarChart3, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  return (
    <Card className="border border-blue-100 bg-white shadow-md overflow-hidden rounded-2xl">
      <CardHeader className="pb-4 border-b border-blue-50 bg-gradient-to-br from-blue-50/20 to-transparent">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-blue-950 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Cooperative Ranking Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Evaluate and sort individual cooperative performance figures using your formula
              indicators.
            </CardDescription>
          </div>
          <div className="w-full md:w-72">
            <Input
              placeholder="Search cooperative or region..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="border-blue-200 focus-visible:ring-blue-500 shadow-sm rounded-xl"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-blue-50 text-xs font-bold uppercase tracking-wider text-blue-800 z-10">
              <tr>
                <th
                  onClick={() => onSort("name")}
                  className="p-4 cursor-pointer hover:bg-blue-50/80 hover:text-blue-950 transition-colors select-none whitespace-nowrap min-w-[240px]"
                >
                  <div className="flex items-center gap-1.5">
                    Cooperative Name
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
                  className="p-4 cursor-pointer hover:bg-blue-50/80 hover:text-blue-950 transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    Region
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
                    className="p-4 cursor-pointer hover:bg-blue-50/80 hover:text-blue-950 transition-colors text-right select-none whitespace-nowrap min-w-[150px]"
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
                    No matching cooperatives found.
                  </td>
                </tr>
              ) : (
                filteredCooperatives.map((coop) => (
                  <tr key={coop.cooperative_id} className="hover:bg-blue-50/10 transition-colors">
                    <td className="p-4 font-bold text-blue-950">{coop.name}</td>
                    <td className="p-4 text-muted-foreground text-xs">{coop.region || "—"}</td>
                    {kpis.map((kpi) => {
                      const val = coop.custom_kpis?.[kpi.name];
                      const hasVal = val !== undefined && val !== null;
                      return (
                        <td
                          key={kpi.id}
                          className="p-4 text-right font-mono font-bold text-blue-700"
                        >
                          {hasVal ? (
                            val >= 1000 ? (
                              val.toLocaleString(undefined, { maximumFractionDigits: 1 })
                            ) : (
                              val.toFixed(2)
                            )
                          ) : (
                            <span className="text-muted-foreground/30 font-normal italic text-xs">
                              No Data
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
