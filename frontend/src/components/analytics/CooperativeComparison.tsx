import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  Cell,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useNationalOverview, CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { Card } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

interface CooperativeComparisonProps {
  reportingYear: number;
}

// Complete KPI List (Financial + Non-Financial)
const COMPARABLE_KPIS = [
  // --- Financial Balances & Ratios ---
  { key: "total_assets", label: "Total Assets", unit: "SZL", isNf: false },
  { key: "gross_loan_portfolio", label: "Gross Loan Portfolio", unit: "SZL", isNf: false },
  { key: "net_loan_portfolio", label: "Net Loan Portfolio", unit: "SZL", isNf: false },
  { key: "total_member_deposits", label: "Total Member Deposits", unit: "SZL", isNf: false },
  { key: "total_equity", label: "Total Equity", unit: "SZL", isNf: false },
  { key: "net_surplus", label: "Net Surplus/Deficit", unit: "SZL", isNf: false },
  { key: "capital_adequacy_ratio", label: "Capital Adequacy Ratio (CAR)", unit: "%", isNf: false },
  { key: "liquid_funds_ratio", label: "Liquid Funds Ratio", unit: "%", isNf: false },
  { key: "npl_ratio", label: "Non-Performing Loans (NPL) Ratio", unit: "%", isNf: false },
  { key: "par30", label: "Portfolio at Risk (PAR30)", unit: "%", isNf: false },
  { key: "par90", label: "Portfolio at Risk (PAR90)", unit: "%", isNf: false },
  { key: "loan_loss_coverage", label: "Loan Loss Coverage Ratio", unit: "%", isNf: false },
  { key: "roa", label: "Return on Assets (ROA)", unit: "%", isNf: false },
  { key: "roe", label: "Return on Equity (ROE)", unit: "%", isNf: false },
  { key: "operating_expense_ratio", label: "Operating Expense Ratio", unit: "%", isNf: false },
  {
    key: "operational_self_sufficiency",
    label: "Operational Self-Sufficiency",
    unit: "%",
    isNf: false,
  },
  { key: "net_interest_margin", label: "Net Interest Margin", unit: "%", isNf: false },
  { key: "deposits_to_loans", label: "Deposits to Loans Ratio", unit: "%", isNf: false },

  // --- Non-Financial Metrics ---
  { key: "total_members", label: "Total Members", unit: "count", isNf: true },
  { key: "active_members_pct", label: "Active Members %", unit: "%", isNf: true },
  { key: "savings_penetration_pct", label: "Savings Penetration %", unit: "%", isNf: true },
  { key: "credit_penetration_pct", label: "Credit Penetration %", unit: "%", isNf: true },
  { key: "fd_penetration_pct", label: "FD Penetration %", unit: "%", isNf: true },
  { key: "on_time_repayment_pct", label: "On-time Repayment %", unit: "%", isNf: true },
  { key: "dormancy_pct", label: "Dormancy Rate %", unit: "%", isNf: true },
  { key: "agm_participation_pct", label: "AGM Participation %", unit: "%", isNf: true },
  { key: "arrears_rate_pct", label: "Loan Arrears Rate %", unit: "%", isNf: true },
  { key: "fd_early_withdrawal_pct", label: "FD Early Withdrawal %", unit: "%", isNf: true },
];

export function CooperativeComparison({ reportingYear }: CooperativeComparisonProps) {
  const { role, user } = useAuth();
  const isCoopUser = role === "cooperative";

  // 1. Fetch national overview containing all cooperatives and their KPIs
  const { data: overview, isLoading } = useNationalOverview({ reportingYear });

  const cooperatives = useMemo(() => {
    return overview?.cooperatives ?? [];
  }, [overview]);

  // Cooperatives with valid submission data
  const cooperativesWithData = useMemo(() => {
    return cooperatives.filter((c) => c.has_data);
  }, [cooperatives]);

  // Helper to extract a value for a KPI (financial or non-financial) from a cooperative row
  const getCoopKpiValue = (
    coop: CoopKpiRow | Record<string, unknown>,
    kpi: (typeof COMPARABLE_KPIS)[number],
  ) => {
    if (!coop) return 0;
    if (kpi.isNf) {
      return (
        ((coop as Record<string, unknown>)["non_financial"] as Record<string, number>)?.[kpi.key] ??
        0
      );
    }
    return (
      ((coop as Record<string, unknown>)["kpis"] as Record<string, { value: number }>)?.[kpi.key]
        ?.value ?? 0
    );
  };

  // Determine initial selected cooperative
  const defaultCoopId = useMemo(() => {
    if (isCoopUser && user?.cooperationId) {
      return user.cooperationId;
    }
    return cooperativesWithData[0]?.cooperative_id ?? "all";
  }, [isCoopUser, user, cooperativesWithData]);

  const [selectedCoopId, setSelectedCoopId] = useState<string>("");
  const [compareTargetId, setCompareTargetId] = useState<string>("national_average");
  const [selectedKpi, setSelectedKpi] = useState<string>("capital_adequacy_ratio");

  // Keep state synced with default when data loads
  React.useEffect(() => {
    if (defaultCoopId && defaultCoopId !== "all" && !selectedCoopId) {
      setSelectedCoopId(defaultCoopId);
    }
  }, [defaultCoopId, selectedCoopId]);

  const activeCoopId = selectedCoopId || defaultCoopId;

  // Selected cooperative details
  const selectedCoop = useMemo(() => {
    return cooperatives.find((c) => c.cooperative_id === activeCoopId);
  }, [cooperatives, activeCoopId]);

  // Selected target details (National Average or Coop B)
  const compareTarget = useMemo(() => {
    if (compareTargetId === "national_average") {
      return { name: "National Average", isAverage: true };
    }
    const coop = cooperatives.find((c) => c.cooperative_id === compareTargetId);
    return coop ? { ...coop, isAverage: false } : { name: "National Average", isAverage: true };
  }, [cooperatives, compareTargetId]);

  // Dynamic system averages for comparable KPIs (supporting both types)
  const systemAverages = useMemo(() => {
    const averages: Record<string, number> = {};
    COMPARABLE_KPIS.forEach((kpi) => {
      const validValues = cooperativesWithData
        .map((c) => getCoopKpiValue(c, kpi))
        .filter((val): val is number => val !== undefined && !isNaN(val));

      if (validValues.length > 0) {
        averages[kpi.key] = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
      } else {
        averages[kpi.key] = 0;
      }
    });
    return averages;
  }, [cooperativesWithData]);

  // Formatting helper
  const formatValue = (val: number, unit: string) => {
    if (unit === "%") {
      return `${val.toFixed(2)}%`;
    }
    if (unit === "count") {
      return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    if (val >= 1_000_000) {
      return `SZL ${(val / 1_000_000).toFixed(2)}M`;
    }
    if (val >= 1_000) {
      return `SZL ${(val / 1_000).toFixed(1)}K`;
    }
    return `SZL ${val.toFixed(2)}`;
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!selectedCoop || !selectedCoop.has_data) return [];
    const kpiInfo = COMPARABLE_KPIS.find((k) => k.key === selectedKpi);
    if (!kpiInfo) return [];

    const coopVal = getCoopKpiValue(selectedCoop, kpiInfo);

    let targetVal = 0;
    if (compareTarget.isAverage) {
      targetVal = systemAverages[selectedKpi] ?? 0;
    } else {
      targetVal = getCoopKpiValue(compareTarget, kpiInfo);
    }

    return [
      {
        name: selectedCoop.name,
        Value: coopVal,
        color: "#3b82f6",
      },
      {
        name: compareTarget.name,
        Value: targetVal,
        color: "#10b981",
      },
    ];
  }, [selectedCoop, selectedKpi, systemAverages, compareTarget]);

  const activeKpiInfo = useMemo(() => {
    return COMPARABLE_KPIS.find((k) => k.key === selectedKpi);
  }, [selectedKpi]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading benchmarking tools...
      </div>
    );
  }

  // Handle case where no cooperatives have data
  if (cooperativesWithData.length === 0) {
    return (
      <div className="text-center py-12 border rounded-2xl bg-muted/10 border-dashed">
        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground opacity-60 mb-2" />
        <h4 className="text-sm font-bold text-foreground">No Benchmarking Data</h4>
        <p className="text-xs text-muted-foreground mt-1">
          Once cooperatives submit approved or submitted statements, comparative statistics will
          generate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title="Cooperative Performance Benchmarking"
        subtitle="Compare a cooperative's financial and non-financial stats against national averages or peer SACCOs"
        info="Benchmarking provides comparative analysis against national averages to highlight operational variances and compliance standing."
      >
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Select Cooperative
            </label>
            <Select value={activeCoopId} onValueChange={setSelectedCoopId} disabled={isCoopUser}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose cooperative to benchmark..." />
              </SelectTrigger>
              <SelectContent>
                {cooperativesWithData.map((c) => (
                  <SelectItem key={c.cooperative_id} value={c.cooperative_id}>
                    {c.name} ({c.region ?? "Unknown Region"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Compare With
            </label>
            <Select value={compareTargetId} onValueChange={setCompareTargetId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select target..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="national_average">National Average</SelectItem>
                {cooperativesWithData
                  .filter((c) => c.cooperative_id !== activeCoopId)
                  .map((c) => (
                    <SelectItem key={c.cooperative_id} value={c.cooperative_id}>
                      {c.name} ({c.region ?? "Unknown Region"})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Benchmark Metric
            </label>
            <Select value={selectedKpi} onValueChange={setSelectedKpi}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose KPI to visualize..." />
              </SelectTrigger>
              <SelectContent>
                {COMPARABLE_KPIS.map((kpi) => (
                  <SelectItem key={kpi.key} value={kpi.key}>
                    {kpi.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedCoop && !selectedCoop.has_data ? (
          <div className="p-6 border rounded-xl bg-amber-50/50 border-amber-200 text-amber-700 text-sm">
            The selected cooperative has no submitted data for the year {reportingYear}.
          </div>
        ) : selectedCoop && activeKpiInfo ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recharts Bar Chart */}
            <div className="lg:col-span-2 border border-border bg-muted/10 rounded-xl p-4 flex flex-col justify-between h-[300px]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <ArrowRightLeft className="size-3.5 text-primary" />
                {activeKpiInfo.label} Comparison
              </h4>
              <div className="flex-1 w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" stroke="currentColor" fontSize={11} opacity={0.7} />
                    <YAxis stroke="currentColor" fontSize={11} opacity={0.7} />
                    <ChartTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(val: unknown) => [
                        formatValue(Number(val), activeKpiInfo.unit),
                        activeKpiInfo.label,
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="Value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Metrics Summary */}
            <div className="border border-border rounded-xl p-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                  Benchmarking Insight
                </h4>
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      {selectedCoop.name}
                    </span>
                    <p className="font-heading text-2xl font-bold text-foreground num mt-0.5">
                      {formatValue(
                        getCoopKpiValue(selectedCoop, activeKpiInfo),
                        activeKpiInfo.unit,
                      )}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      {compareTarget.name}
                    </span>
                    <p className="font-heading text-2xl font-bold text-foreground num mt-0.5">
                      {(() => {
                        let targetVal = 0;
                        if (compareTarget.isAverage) {
                          targetVal = systemAverages[selectedKpi] ?? 0;
                        } else {
                          targetVal = getCoopKpiValue(compareTarget, activeKpiInfo);
                        }
                        return formatValue(targetVal, activeKpiInfo.unit);
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                {(() => {
                  const coopVal = getCoopKpiValue(selectedCoop, activeKpiInfo);

                  let targetVal = 0;
                  if (compareTarget.isAverage) {
                    targetVal = systemAverages[selectedKpi] ?? 0;
                  } else {
                    targetVal = getCoopKpiValue(compareTarget, activeKpiInfo);
                  }

                  const diff = coopVal - targetVal;
                  const percentDiff = targetVal > 0 ? (diff / targetVal) * 100 : 0;

                  // Lower is better for NPL, PAR, and dormancy indicators
                  const isPositiveIndicator = ![
                    "npl_ratio",
                    "par30",
                    "par90",
                    "dormancy_pct",
                    "arrears_rate_pct",
                    "fd_early_withdrawal_pct",
                  ].includes(selectedKpi);
                  const isBetter = isPositiveIndicator ? diff >= 0 : diff <= 0;

                  return (
                    <div
                      className={`flex items-start gap-2.5 rounded-lg p-3 ${
                        isBetter
                          ? "bg-success/5 border border-success/20 text-success"
                          : "bg-destructive/5 border border-destructive/20 text-destructive"
                      }`}
                    >
                      {isBetter ? (
                        <CheckCircle className="size-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-xs font-bold leading-none">
                          {isBetter ? "Outperforming benchmark" : "Below benchmark"}
                        </p>
                        <p className="text-[11px] opacity-80 mt-1 leading-normal">
                          {isBetter ? "Performing " : "Standing "}
                          {Math.abs(percentDiff).toFixed(1)}% {isBetter ? "above" : "below"} the
                          selected target for this reporting period.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* KPI Comparison Matrix Table */}
      {selectedCoop && selectedCoop.has_data && (
        <Card
          title="Benchmarking KPI Matrix"
          subtitle={`Complete financial & non-financial comparison for ${selectedCoop.name} against ${compareTarget.name}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Metric/KPI</th>
                  <th className="py-3 px-4 text-right">{selectedCoop.name}</th>
                  <th className="py-3 px-4 text-right">{compareTarget.name}</th>
                  <th className="py-3 px-4 text-right">Variance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARABLE_KPIS.map((kpi) => {
                  const coopVal = getCoopKpiValue(selectedCoop, kpi);

                  let targetVal = 0;
                  if (compareTarget.isAverage) {
                    targetVal = systemAverages[kpi.key] ?? 0;
                  } else {
                    targetVal = getCoopKpiValue(compareTarget, kpi);
                  }

                  const diff = coopVal - targetVal;
                  const percentDiff = targetVal > 0 ? (diff / targetVal) * 100 : 0;

                  // Direction indicators
                  const isPositiveIndicator = ![
                    "npl_ratio",
                    "par30",
                    "par90",
                    "dormancy_pct",
                    "arrears_rate_pct",
                    "fd_early_withdrawal_pct",
                  ].includes(kpi.key);
                  const isBetter = isPositiveIndicator ? diff >= 0 : diff <= 0;

                  return (
                    <tr
                      key={kpi.key}
                      className={`hover:bg-muted/30 transition-colors ${
                        selectedKpi === kpi.key ? "bg-primary/5 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-medium flex items-center gap-2">
                        {kpi.label}
                      </td>
                      <td className="py-3.5 px-4 text-right num">
                        {formatValue(coopVal, kpi.unit)}
                      </td>
                      <td className="py-3.5 px-4 text-right num text-muted-foreground">
                        {formatValue(targetVal, kpi.unit)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right num ${
                          diff === 0
                            ? "text-muted-foreground"
                            : isBetter
                              ? "text-success"
                              : "text-destructive"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}
                        {kpi.unit === "%" ? `${diff.toFixed(2)}%` : formatValue(diff, kpi.unit)}
                        <span className="text-[10px] ml-1 opacity-70">
                          ({diff > 0 ? "+" : ""}
                          {percentDiff.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isBetter
                              ? "bg-success/10 text-success"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {isBetter ? (
                            <>
                              <TrendingUp className="size-3" /> Healthy
                            </>
                          ) : (
                            <>
                              <TrendingDown className="size-3" /> Watch
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
