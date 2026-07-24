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
  Search,
  BookOpen,
  Users,
  Percent,
  Coins,
  ShieldAlert,
} from "lucide-react";

interface CooperativeComparisonProps {
  reportingYear: number;
}

// Group definitions for KPIs
const KPI_GROUPS = {
  balances: {
    label: "Financial Balances",
    icon: Coins,
    colorClass: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
  },
  ratios: {
    label: "Financial Ratios & Risk",
    icon: Percent,
    colorClass: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30",
  },
  non_financial: {
    label: "Member & Operational Indicators",
    icon: Users,
    colorClass: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
  },
};

// Complete KPI List (Financial + Non-Financial) with group classifications
const COMPARABLE_KPIS = [
  // --- Financial Balances ---
  {
    key: "total_assets",
    label: "Total Assets",
    unit: "SZL",
    isNf: false,
    group: "balances",
    description: "Total value of all assets owned by the cooperative",
  },
  {
    key: "gross_loan_portfolio",
    label: "Gross Loan Portfolio",
    unit: "SZL",
    isNf: false,
    group: "balances",
    description: "Total outstanding loan balance including arrears",
  },
  {
    key: "net_loan_portfolio",
    label: "Net Loan Portfolio",
    unit: "SZL",
    isNf: false,
    group: "balances",
    description: "Gross Loan Portfolio minus Loan Loss Provisions",
  },
  {
    key: "total_member_deposits",
    label: "Total Member Deposits",
    unit: "SZL",
    isNf: false,
    group: "balances",
    description: "Total member savings and deposits",
  },
  {
    key: "total_equity",
    label: "Total Equity",
    unit: "SZL",
    isNf: false,
    group: "balances",
    description: "Total institutional capital and reserves",
  },
  {
    key: "net_surplus",
    label: "Net Surplus/Deficit",
    unit: "SZL",
    isNf: false,
    group: "balances",
    description: "Net income after all expenses (Total Income - Total Expenses)",
  },

  // --- Financial Ratios & Risk ---
  {
    key: "capital_adequacy_ratio",
    label: "Capital Adequacy Ratio (CAR)",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Total institutional capital / Total Assets (Standard benchmark: 10%+)",
  },
  {
    key: "liquid_funds_ratio",
    label: "Liquid Funds Ratio",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Liquid assets / Total Assets (Standard benchmark: 15%+)",
  },
  {
    key: "npl_ratio",
    label: "Non-Performing Loans (NPL) Ratio",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Loans in arrears >90 days / gross loan portfolio (Standard target: <5%)",
  },
  {
    key: "par30",
    label: "Portfolio at Risk (PAR30)",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Loans in arrears >30 days / gross loan portfolio (Standard target: <5%)",
  },
  {
    key: "par90",
    label: "Portfolio at Risk (PAR90)",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Loans in arrears >90 days / gross loan portfolio",
  },
  {
    key: "loan_loss_coverage",
    label: "Loan Loss Coverage Ratio",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Loan loss provisions / Loans in arrears >30 days (Standard target: 100%)",
  },
  {
    key: "roa",
    label: "Return on Assets (ROA)",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Return on Assets (Net Surplus / Total Assets) (Target: 3%+)",
  },
  {
    key: "roe",
    label: "Return on Equity (ROE)",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Return on Equity (Net Surplus / Total Equity)",
  },
  {
    key: "operating_expense_ratio",
    label: "Operating Expense Ratio",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Operating expenses / Total Assets",
  },
  {
    key: "operational_self_sufficiency",
    label: "Operational Self-Sufficiency",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Total operating income / Total expenses (Target: 100%+)",
  },
  {
    key: "net_interest_margin",
    label: "Net Interest Margin",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Net interest income / Total Assets",
  },
  {
    key: "deposits_to_loans",
    label: "Deposits to Loans Ratio",
    unit: "%",
    isNf: false,
    group: "ratios",
    description: "Total member deposits / Gross loan portfolio",
  },

  // --- Non-Financial Metrics ---
  {
    key: "total_members",
    label: "Total Members",
    unit: "count",
    isNf: true,
    group: "non_financial",
    description: "Total number of registered members",
  },
  {
    key: "active_members_pct",
    label: "Active Members %",
    unit: "%",
    isNf: true,
    group: "non_financial",
    description: "Percentage of members actively transacting",
  },
  {
    key: "savings_penetration_pct",
    label: "Savings Penetration %",
    unit: "%",
    isNf: true,
    group: "non_financial",
    description: "Percentage of members holding savings accounts",
  },
  {
    key: "credit_penetration_pct",
    label: "Credit Penetration %",
    unit: "%",
    isNf: true,
    group: "non_financial",
    description: "Percentage of members with active loans",
  },
  {
    key: "fd_penetration_pct",
    label: "FD Penetration %",
    unit: "%",
    isNf: true,
    group: "non_financial",
    description: "Percentage of members holding fixed deposits",
  },
  {
    key: "on_time_repayment_pct",
    label: "On-time Repayment %",
    unit: "%",
    isNf: true,
    group: "non_financial",
    description: "Percentage of loan repayments received on time",
  },
  {
    key: "dormancy_pct",
    label: "Dormancy Rate %",
    unit: "%",
    isNf: true,
    group: "non_financial",
    description: "Percentage of inactive member accounts",
  },
  {
    key: "agm_participation_pct",
    label: "AGM Participation %",
    unit: "%",
    isNf: true,
    group: "non_financial",
    description: "Percentage of members participating in the AGM",
  },
  {
    key: "arrears_rate_pct",
    label: "Loan Arrears Rate %",
    unit: "%",
    isNf: true,
    group: "non_financial",
    description: "Percentage of loan portfolio in arrears",
  },
  {
    key: "fd_early_withdrawal_pct",
    label: "FD Early Withdrawal %",
    unit: "%",
    isNf: true,
    group: "non_financial",
    description: "Percentage of fixed deposits withdrawn prematurely",
  },
] as const;

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

  // Helper to extract a value for a KPI from a cooperative row
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
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  // Dynamic system averages for comparable KPIs
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

  // Filtered KPIs for matrix table based on query
  const filteredKpis = useMemo(() => {
    return COMPARABLE_KPIS.filter(
      (kpi) =>
        kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kpi.description.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <span className="text-sm font-medium tracking-wide">
          Assembling performance statistics...
        </span>
      </div>
    );
  }

  // Handle case where no cooperatives have data
  if (cooperativesWithData.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
        <ShieldAlert className="mx-auto h-12 w-12 text-slate-400 opacity-60 mb-3" />
        <h4 className="text-base font-bold text-slate-900 dark:text-white">
          No Benchmarking Data Available
        </h4>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Once cooperatives submit approved or submitted statements for {reportingYear}, comparative
          benchmarks will auto-generate here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title="Cooperative Performance Benchmarking"
        subtitle={`Compare SACCO performance metrics against national averages and peer organizations for the calendar year ${reportingYear}`}
        info="Compare standard PEARLS ratios, portfolio distributions, and non-financial data points side-by-side."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-500" /> Target Cooperative
            </label>
            <Select value={activeCoopId} onValueChange={setSelectedCoopId} disabled={isCoopUser}>
              <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-850 hover:bg-slate-100/50 dark:hover:bg-slate-950/40 transition-colors">
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

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <ArrowRightLeft className="size-3.5 text-emerald-500" /> Comparison Peer
            </label>
            <Select value={compareTargetId} onValueChange={setCompareTargetId}>
              <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-850 hover:bg-slate-100/50 dark:hover:bg-slate-950/40 transition-colors">
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

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Percent className="size-3.5 text-indigo-500" /> Focus Ratio/Metric
            </label>
            <Select value={selectedKpi} onValueChange={setSelectedKpi}>
              <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-850 hover:bg-slate-100/50 dark:hover:bg-slate-950/40 transition-colors">
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
          <div className="p-5 border rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <span>
              The selected cooperative has no submitted data for the year {reportingYear}.
            </span>
          </div>
        ) : selectedCoop && activeKpiInfo ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Recharts Bar Chart */}
            <div className="lg:col-span-2 border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/10 rounded-2xl p-5 flex flex-col justify-between h-[340px]">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
                  <ArrowRightLeft className="size-3.5 text-primary" />
                  Visual Benchmark
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {activeKpiInfo.description}
                </p>
              </div>
              <div className="flex-1 w-full h-[220px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    barSize={50}
                  >
                    <defs>
                      <linearGradient id="colorCoop" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.85} />
                      </linearGradient>
                      <linearGradient id="colorPeer" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="#047857" stopOpacity={0.85} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.06} stroke="currentColor" />
                    <XAxis
                      dataKey="name"
                      stroke="currentColor"
                      fontSize={11}
                      opacity={0.6}
                      tickLine={false}
                    />
                    <YAxis stroke="currentColor" fontSize={11} opacity={0.6} tickLine={false} />
                    <ChartTooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.05)", radius: 8 }}
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        borderColor: "rgba(51, 65, 85, 0.5)",
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                      }}
                      labelStyle={{ color: "#fff", fontWeight: "bold", fontSize: "11px" }}
                      itemStyle={{ color: "#94a3b8", fontSize: "11px" }}
                      formatter={(val: unknown) => [
                        <span className="text-white font-bold">
                          {formatValue(Number(val), activeKpiInfo.unit)}
                        </span>,
                        activeKpiInfo.label,
                      ]}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                    <Bar dataKey="Value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? "url(#colorCoop)" : "url(#colorPeer)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Metrics Summary */}
            <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
              <div className="space-y-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Benchmarking Insight
                </h4>
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-50/30 dark:bg-blue-950/10 rounded-xl border border-blue-100/50 dark:border-blue-900/10">
                    <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">
                      {selectedCoop.name}
                    </span>
                    <p className="font-heading text-2xl font-bold text-slate-900 dark:text-white num mt-0.5">
                      {formatValue(
                        getCoopKpiValue(selectedCoop, activeKpiInfo),
                        activeKpiInfo.unit,
                      )}
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/10">
                    <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                      {compareTarget.name}
                    </span>
                    <p className="font-heading text-2xl font-bold text-slate-900 dark:text-white num mt-0.5">
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

              <div className="mt-5">
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
                      className={`flex items-start gap-2.5 rounded-xl p-3.5 border transition-all ${
                        isBetter
                          ? "bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-350"
                          : "bg-rose-50/40 dark:bg-rose-950/10 border-rose-200/50 dark:border-rose-900/30 text-rose-700 dark:text-rose-350"
                      }`}
                    >
                      {isBetter ? (
                        <CheckCircle className="size-4 shrink-0 mt-0.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-500" />
                      )}
                      <div>
                        <p className="text-xs font-bold leading-none">
                          {isBetter ? "Outperforming Peer Group" : "Performance Watch Required"}
                        </p>
                        <p className="text-[11px] opacity-80 mt-1.5 leading-normal">
                          {isBetter ? "Performing " : "Standing "}
                          <span className="font-bold">
                            {Math.abs(percentDiff).toFixed(1)}%
                          </span>{" "}
                          {isBetter ? "above" : "below"} the selected peer average.
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
          subtitle={`Detailed financial and operational ratios mapped side-by-side with comparison delta`}
        >
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search KPI or ratios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-slate-700 dark:text-slate-350"
              />
            </div>
            <div className="flex gap-2 text-slate-500">
              {Object.entries(KPI_GROUPS).map(([key, group]) => {
                const count = COMPARABLE_KPIS.filter((kpi) => kpi.group === key).length;
                const Icon = group.icon;
                return (
                  <div
                    key={key}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg text-slate-500 dark:text-slate-400"
                  >
                    <Icon className="size-3" />
                    <span>{group.label}</span>
                    <span className="text-[9px] bg-slate-200/50 dark:bg-slate-800/80 px-1 rounded text-slate-600 dark:text-slate-400">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800/60 rounded-xl">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-850 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20">
                  <th className="py-3 px-4">Metric/KPI</th>
                  <th className="py-3 px-4 text-right">{selectedCoop.name}</th>
                  <th className="py-3 px-4 text-right">{compareTarget.name}</th>
                  <th className="py-3 px-4 text-right">Variance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {Object.entries(KPI_GROUPS).map(([groupKey, groupInfo]) => {
                  const groupKpis = filteredKpis.filter((kpi) => kpi.group === groupKey);
                  if (groupKpis.length === 0) return null;

                  const GroupIcon = groupInfo.icon;

                  return (
                    <React.Fragment key={groupKey}>
                      {/* Group Divider */}
                      <tr className="bg-slate-50/30 dark:bg-slate-950/10">
                        <td
                          colSpan={5}
                          className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500"
                        >
                          <div className="flex items-center gap-1.5 font-sans">
                            <div className={`p-1 rounded ${groupInfo.colorClass}`}>
                              <GroupIcon className="size-3.5" />
                            </div>
                            {groupInfo.label}
                          </div>
                        </td>
                      </tr>

                      {groupKpis.map((kpi) => {
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
                            className={`group hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors ${
                              selectedKpi === kpi.key
                                ? "bg-primary/5 dark:bg-primary/5 font-semibold"
                                : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-slate-800 dark:text-slate-300">
                              <div className="flex items-center gap-1.5 font-sans">
                                <span
                                  className="cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
                                  onClick={() => setSelectedKpi(kpi.key)}
                                >
                                  {kpi.label}
                                </span>
                                <div className="group relative">
                                  <HelpCircle className="size-3 text-slate-300 dark:text-slate-650 hover:text-slate-500 cursor-help" />
                                  <div className="pointer-events-none absolute left-0 bottom-full mb-1 w-64 rounded-lg bg-slate-950 p-2 text-[10px] text-white opacity-0 shadow-lg transition-all group-hover:opacity-100 z-50 leading-relaxed font-normal">
                                    {kpi.description}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right num text-slate-900 dark:text-white font-medium font-mono">
                              {formatValue(coopVal, kpi.unit)}
                            </td>
                            <td className="py-3 px-4 text-right num text-slate-400 dark:text-slate-500 font-mono">
                              {formatValue(targetVal, kpi.unit)}
                            </td>
                            <td
                              className={`py-3 px-4 text-right num font-semibold font-mono ${
                                diff === 0
                                  ? "text-slate-450 dark:text-slate-500"
                                  : isBetter
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {diff > 0 ? "+" : ""}
                              {kpi.unit === "%"
                                ? `${diff.toFixed(2)}%`
                                : formatValue(diff, kpi.unit)}
                              {targetVal > 0 && (
                                <span className="text-[9px] ml-1 opacity-70 font-normal">
                                  ({diff > 0 ? "+" : ""}
                                  {percentDiff.toFixed(1)}%)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  isBetter
                                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                    : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30"
                                }`}
                              >
                                {isBetter ? (
                                  <>
                                    <TrendingUp className="size-2.5" /> Healthy
                                  </>
                                ) : (
                                  <>
                                    <TrendingDown className="size-2.5" /> Watch
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
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
