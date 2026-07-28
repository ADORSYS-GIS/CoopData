import React from "react";

interface ConsolidatedRiskWatchSheetProps {
  data: any;
}

export const ConsolidatedRiskWatchSheet: React.FC<ConsolidatedRiskWatchSheetProps> = ({ data }) => {
  const { cooperatives } = data;

  const getAction = (kpiName: string) => {
    if (kpiName === "par30" || kpiName === "par90") return "Remedial plan needed";
    if (kpiName === "capital_adequacy_ratio") return "Capital injection / review";
    if (kpiName === "operating_expense_ratio") return "Cost reduction strategy";
    if (kpiName === "roa" || kpiName === "roe") return "Profitability review";
    if (kpiName === "liquid_funds_ratio") return "Liquidity management plan";
    return "Follow-up required";
  };

  const getThresholdStr = (kpiName: string, benchmark: number | undefined) => {
    if (benchmark === undefined) return "—";
    if (["par30", "par90", "npl_ratio", "operating_expense_ratio"].includes(kpiName)) {
      return `<= ${benchmark.toFixed(1)}%`;
    }
    return `>= ${benchmark.toFixed(1)}%`;
  };

  const getSeverity = (kpiName: string) => {
    if (["par30", "capital_adequacy_ratio", "liquid_funds_ratio"].includes(kpiName)) return "Critical";
    return "High";
  };

  // Find all red KPIs
  const riskRows: any[] = [];
  cooperatives.forEach((coop: any) => {
    if (!coop.kpis) return;
    Object.entries(coop.kpis).forEach(([kpiName, kpiVal]: [string, any]) => {
      if (kpiVal.status === "red") {
        riskRows.push({
          coopName: coop.name,
          kpiName,
          value: kpiVal.value,
          formatted: kpiVal.formatted,
          benchmark: kpiVal.benchmark,
        });
      }
    });
  });

  return (
    <div className="relative flex flex-col w-[210mm] min-h-[296mm] p-12 bg-white break-after-page">
      <div>
        <h2 className="text-xl font-bold text-blue-800 mb-4">Sheet 3: "Under Intervention / Risk Watch"</h2>
        <p className="text-sm text-slate-600 mb-6 italic">
          This sheet highlights all cooperatives with critical indicators falling into the "Red" (High Risk) category.
        </p>

        {riskRows.length === 0 ? (
          <div className="p-8 text-center text-slate-500 border border-slate-200 rounded-lg bg-slate-50">
            No cooperatives currently in the high-risk category.
          </div>
        ) : (
          <table className="w-full text-left text-xs mb-8 border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-2 border border-slate-700">Cooperative</th>
                <th className="p-2 border border-slate-700">Risk Indicator</th>
                <th className="p-2 border border-slate-700">Value</th>
                <th className="p-2 border border-slate-700">Threshold</th>
                <th className="p-2 border border-slate-700">Severity</th>
                <th className="p-2 border border-slate-700">Action Required</th>
              </tr>
            </thead>
            <tbody>
              {riskRows.map((row, i) => {
                const bgClass = i % 2 === 0 ? "bg-white" : "bg-slate-50";
                return (
                  <tr key={`${row.coopName}-${row.kpiName}`} className={bgClass}>
                    <td className="p-2 border border-slate-300 font-bold truncate max-w-[150px]">{row.coopName}</td>
                    <td className="p-2 border border-slate-300 capitalize">{row.kpiName.replace(/_/g, " ")}</td>
                    <td className="p-2 border border-slate-300 font-bold text-red-600 whitespace-nowrap">
                      {row.formatted} <span className="w-2 h-2 inline-block rounded-full bg-red-500 ml-1"></span>
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">{getThresholdStr(row.kpiName, row.benchmark)}</td>
                    <td className="p-2 border border-slate-300">{getSeverity(row.kpiName)}</td>
                    <td className="p-2 border border-slate-300">{getAction(row.kpiName)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Footer */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-4 border-t border-slate-200 mt-auto">
        <p>CoopData — Report Export Templates</p>
        <p>Page 4</p>
      </div>
    </div>
  );
};
