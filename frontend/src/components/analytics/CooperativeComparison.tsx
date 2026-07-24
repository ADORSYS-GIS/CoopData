import React, { useState, useMemo, useCallback } from "react";
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
import { useComparativeStatements } from "@/hooks/analytics/useComparativeStatements";
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
  Users,
  Percent,
  Coins,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import { createEmptyBalanceSheet, type BalanceSheet } from "@/lib/financial-data";
import { calculateFinancialKPIs } from "@/lib/kpi-calculations";

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

const MONTH_OPTIONS = [
  { value: "annual", label: "Annual (Year-End)" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function buildBalanceSheetFromLineItems(
  items: { account_code?: number | null; value: number }[],
): BalanceSheet {
  const bs = createEmptyBalanceSheet();

  for (const item of items) {
    if (!item.account_code) continue;
    const val = item.value;

    switch (item.account_code) {
      // Liquid Assets
      case 1101:
        bs.liquidAssets.cashOnHand = val;
        break;
      case 1102:
        bs.liquidAssets.cashAtBankCurrent = val;
        break;
      case 1103:
        bs.liquidAssets.cashAtBankSavings = val;
        break;
      case 1104:
        bs.liquidAssets.shortTermInvestments = val;
        break;

      // Loan Portfolio
      case 1201:
        bs.loanPortfolio.performingLoanPortfolio = val;
        break;
      case 1202:
        bs.loanPortfolio.loansInArrears_1_30 = val;
        break;
      case 1203:
        bs.loanPortfolio.loansInArrears_31_60 = val;
        break;
      case 1204:
        bs.loanPortfolio.loansInArrears_61_90 = val;
        break;
      case 1205:
        bs.loanPortfolio.nonPerformingLoans = val;
        break;

      // Provisions
      case 1251:
        bs.loanLossProvisions.generalLoanLossProvision = val;
        break;
      case 1252:
        bs.loanLossProvisions.specificLoanLossProvision = val;
        break;

      // Other Assets
      case 1301:
        bs.otherAssets.accountsReceivable = val;
        break;
      case 1302:
        bs.otherAssets.prepaidExpenses = val;
        break;
      case 1303:
        bs.otherAssets.fixedAssetsCost = val;
        break;
      case 1304:
        bs.otherAssets.accumulatedDepreciation = val;
        break;
      case 1305:
        bs.otherAssets.intangibleAssets = val;
        break;

      // Member Deposits
      case 2101:
        bs.memberDeposits.voluntarySavings = val;
        break;
      case 2102:
        bs.memberDeposits.mandatorySavings = val;
        break;
      case 2103:
        bs.memberDeposits.fixedTermDeposits = val;
        break;

      // Borrowings
      case 2201:
        bs.borrowings.shortTermBorrowings = val;
        break;
      case 2202:
        bs.borrowings.longTermBorrowings = val;
        break;

      // Other Liabilities
      case 2301:
        bs.otherLiabilities.accountsPayable = val;
        break;
      case 2302:
        bs.otherLiabilities.accruedExpenses = val;
        break;
      case 2303:
        bs.otherLiabilities.deferredIncome = val;
        break;

      // Member Shares
      case 3101:
        bs.memberShares.permanentShareCapital = val;
        break;
      case 3102:
        bs.memberShares.withdrawableShares = val;
        break;

      // Reserves
      case 3201:
        bs.reserves.statutoryReserve = val;
        break;
      case 3202:
        bs.reserves.generalReserve = val;
        break;
      case 3203:
        bs.reserves.riskCapitalAdequacyReserve = val;
        break;

      // Retained Earnings
      case 3301:
        bs.retainedEarnings.accumulatedSurplus = val;
        break;
      case 3302:
        bs.retainedEarnings.currentYearSurplus = val;
        break;

      // Income
      case 4101:
        bs.financialIncome.interestIncomeLoans = val;
        break;
      case 4102:
        bs.financialIncome.feesCommissionsIncome = val;
        break;
      case 4201:
        bs.otherIncome.otherOperatingIncome = val;
        break;

      // Expenses
      case 5101:
        bs.financialExpenses.interestExpenseDeposits = val;
        break;
      case 5102:
        bs.financialExpenses.interestExpenseBorrowings = val;
        break;
      case 5201:
        bs.operatingExpenses.personnelCosts = val;
        break;
      case 5202:
        bs.operatingExpenses.administrativeExpenses = val;
        break;
      case 5203:
        bs.operatingExpenses.governanceExpenses = val;
        break;
      case 5204:
        bs.operatingExpenses.depreciationAmortization = val;
        break;
      case 5301:
        bs.creditLossExpense = val;
        break;
    }
  }

  return bs;
}

export function CooperativeComparison({ reportingYear }: CooperativeComparisonProps) {
  const { role, user } = useAuth();
  const isCoopUser = role === "cooperative";

  // State filters
  const [selectedMonth, setSelectedMonth] = useState<string>("annual");
  const [selectedCoopId, setSelectedCoopId] = useState<string>("");
  const [compareTargetId, setCompareTargetId] = useState<string>("national_average");
  const [selectedKpi, setSelectedKpi] = useState<string>("capital_adequacy_ratio");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const showPeerColumn =
    compareTargetId !== "national_average" && compareTargetId !== "region_average";

  // 1. Fetch national overview containing all cooperatives and their metadata
  const { data: overview, isLoading: overviewLoading } = useNationalOverview({ reportingYear });

  // 2. Fetch comparative statements containing raw monthly financial statements
  const { data: statements, isLoading: statementsLoading } = useComparativeStatements({
    reportingYear,
  });

  const isLoading = overviewLoading || statementsLoading;

  const cooperatives = useMemo(() => {
    return overview?.cooperatives ?? [];
  }, [overview]);

  // Cooperatives with valid submission data
  const cooperativesWithData = useMemo(() => {
    return cooperatives.filter((c) => c.has_data);
  }, [cooperatives]);

  // Compute all financial KPIs in-memory for the selected month/period
  const computedCoopKpis = useMemo(() => {
    const kpiMap: Record<string, Record<string, number>> = {};
    if (!statements?.grids) return kpiMap;

    for (const grid of statements.grids) {
      let filteredItems = grid.line_items;
      if (selectedMonth === "annual") {
        const maxMonth = grid.line_items.reduce((max, item) => Math.max(max, item.month), 12);
        filteredItems = grid.line_items.filter((item) => item.month === maxMonth);
      } else {
        filteredItems = grid.line_items.filter((item) => item.month === Number(selectedMonth));
      }

      if (filteredItems.length === 0) continue;

      const bs = buildBalanceSheetFromLineItems(filteredItems);
      const kpis = calculateFinancialKPIs(bs);

      const coopKpis: Record<string, number> = {};
      COMPARABLE_KPIS.forEach((kpi) => {
        if (!kpi.isNf) {
          const camelKey = kpi.key.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
          let val = (kpis as unknown as Record<string, { value: number }>)[camelKey]?.value ?? 0;
          if (kpi.key === "net_surplus") {
            const totalIncome =
              bs.financialIncome.interestIncomeLoans +
              bs.financialIncome.feesCommissionsIncome +
              bs.otherIncome.otherOperatingIncome;
            const totalExpenses =
              bs.financialExpenses.interestExpenseDeposits +
              bs.financialExpenses.interestExpenseBorrowings +
              bs.operatingExpenses.personnelCosts +
              bs.operatingExpenses.administrativeExpenses +
              bs.operatingExpenses.governanceExpenses +
              bs.operatingExpenses.depreciationAmortization +
              bs.creditLossExpense;
            val = totalIncome - totalExpenses;
          }
          coopKpis[kpi.key] = val;
        }
      });
      kpiMap[grid.cooperative_id] = coopKpis;
    }
    return kpiMap;
  }, [statements, selectedMonth]);

  // Retrieve any KPI value (target, peer, or averages)
  const getKpiValue = useCallback(
    (coopId: string, kpi: (typeof COMPARABLE_KPIS)[number]) => {
      if (kpi.isNf) {
        const coop = cooperatives.find((c) => c.cooperative_id === coopId);
        return (coop?.non_financial?.[kpi.key as keyof typeof coop.non_financial] as number) ?? 0;
      }
      return computedCoopKpis[coopId]?.[kpi.key] ?? 0;
    },
    [cooperatives, computedCoopKpis],
  );

  // Determine initial selected cooperative
  const defaultCoopId = useMemo(() => {
    if (isCoopUser && user?.cooperationId) {
      return user.cooperationId;
    }
    return cooperativesWithData[0]?.cooperative_id ?? "all";
  }, [isCoopUser, user, cooperativesWithData]);

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

  // System-wide averages for the selected period
  const systemAverages = useMemo(() => {
    const averages: Record<string, number> = {};
    COMPARABLE_KPIS.forEach((kpi) => {
      const validValues = cooperativesWithData
        .map((c) => getKpiValue(c.cooperative_id, kpi))
        .filter((val) => val !== undefined && !isNaN(val));

      averages[kpi.key] =
        validValues.length > 0
          ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length
          : 0;
    });
    return averages;
  }, [cooperativesWithData, getKpiValue]);

  // Region averages matching the selected cooperative's region
  const regionAverages = useMemo(() => {
    const averages: Record<string, number> = {};
    if (!selectedCoop) return averages;

    const regionCoops = cooperativesWithData.filter((c) => c.region === selectedCoop.region);

    COMPARABLE_KPIS.forEach((kpi) => {
      const validValues = regionCoops
        .map((c) => getKpiValue(c.cooperative_id, kpi))
        .filter((val) => val !== undefined && !isNaN(val));

      averages[kpi.key] =
        validValues.length > 0
          ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length
          : 0;
    });
    return averages;
  }, [selectedCoop, cooperativesWithData, getKpiValue]);

  // Selected comparison target details
  const compareTarget = useMemo(() => {
    if (compareTargetId === "national_average") {
      return { name: "National Average", isSpecial: true };
    }
    if (compareTargetId === "region_average") {
      return { name: `${selectedCoop?.region ?? "Region"} Average`, isSpecial: true };
    }
    const coop = cooperatives.find((c) => c.cooperative_id === compareTargetId);
    return coop ? { ...coop, isSpecial: false } : { name: "National Average", isSpecial: true };
  }, [cooperatives, compareTargetId, selectedCoop]);

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

    const coopVal = getKpiValue(selectedCoop.cooperative_id, kpiInfo);

    let targetVal = 0;
    if (compareTargetId === "national_average") {
      targetVal = systemAverages[selectedKpi] ?? 0;
    } else if (compareTargetId === "region_average") {
      targetVal = regionAverages[selectedKpi] ?? 0;
    } else {
      targetVal = getKpiValue(compareTargetId, kpiInfo);
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
  }, [
    selectedCoop,
    selectedKpi,
    systemAverages,
    regionAverages,
    compareTargetId,
    compareTarget,
    computedCoopKpis,
  ]);

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

  const selectedCoopMonthItems =
    statements?.grids
      ?.find((g) => g.cooperative_id === activeCoopId)
      ?.line_items?.filter(
        (item) => selectedMonth === "annual" || item.month === Number(selectedMonth),
      ) ?? [];

  return (
    <div className="space-y-6">
      <Card
        title="Cooperative Performance Benchmarking"
        subtitle={`Compare SACCO performance metrics against national averages and peer organizations for the calendar year ${reportingYear}`}
        info="Compare standard PEARLS ratios, portfolio distributions, and non-financial data points side-by-side."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                {selectedCoop?.region && (
                  <SelectItem value="region_average">
                    {selectedCoop.region} Region Average
                  </SelectItem>
                )}
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
              <Calendar className="size-3.5 text-orange-500" /> Period / Month
            </label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-850 hover:bg-slate-100/50 dark:hover:bg-slate-950/40 transition-colors">
                <SelectValue placeholder="Choose month..." />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
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

        {selectedCoop && selectedCoopMonthItems.length === 0 ? (
          <div className="p-5 border rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <span>
              The selected cooperative has no statement data for the month of{" "}
              {MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label} in {reportingYear}.
            </span>
          </div>
        ) : selectedCoop && activeKpiInfo ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Recharts Bar Chart */}
            <div className="lg:col-span-2 border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/10 rounded-2xl p-5 flex flex-col justify-between h-[340px]">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
                  <ArrowRightLeft className="size-3.5 text-primary" />
                  Visual Benchmark ({MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label})
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
                    <p className="font-heading text-2xl font-bold text-slate-900 dark:text-white num mt-0.5 font-mono">
                      {formatValue(
                        getKpiValue(selectedCoop.cooperative_id, activeKpiInfo),
                        activeKpiInfo.unit,
                      )}
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/10">
                    <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                      {compareTarget.name}
                    </span>
                    <p className="font-heading text-2xl font-bold text-slate-900 dark:text-white num mt-0.5 font-mono">
                      {(() => {
                        let targetVal = 0;
                        if (compareTargetId === "national_average") {
                          targetVal = systemAverages[selectedKpi] ?? 0;
                        } else if (compareTargetId === "region_average") {
                          targetVal = regionAverages[selectedKpi] ?? 0;
                        } else {
                          targetVal = getKpiValue(compareTargetId, activeKpiInfo);
                        }
                        return formatValue(targetVal, activeKpiInfo.unit);
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {(() => {
                  const coopVal = getKpiValue(selectedCoop.cooperative_id, activeKpiInfo);

                  let targetVal = 0;
                  if (compareTargetId === "national_average") {
                    targetVal = systemAverages[selectedKpi] ?? 0;
                  } else if (compareTargetId === "region_average") {
                    targetVal = regionAverages[selectedKpi] ?? 0;
                  } else {
                    targetVal = getKpiValue(compareTargetId, activeKpiInfo);
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
                        <p className="text-[11px] opacity-85 mt-1.5 leading-normal">
                          {isBetter ? "Performing " : "Standing "}
                          <span className="font-bold">
                            {Math.abs(percentDiff).toFixed(1)}%
                          </span>{" "}
                          {isBetter ? "above" : "below"} the selected peer.
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
      {selectedCoop && selectedCoop.has_data && selectedCoopMonthItems.length > 0 && (
        <Card
          title="Benchmarking KPI Matrix"
          subtitle={`Detailed financial and operational ratios mapped side-by-side with comparison deltas for ${MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label}`}
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
            <div className="flex gap-2 text-slate-500 flex-wrap">
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
            <table className="w-full text-left text-xs border-collapse font-sans min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-850 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950/20">
                  <th className="py-3 px-4 w-[280px]">Metric/KPI</th>
                  <th className="py-3 px-4 text-right text-slate-900 dark:text-white">
                    {selectedCoop.name}
                  </th>
                  {showPeerColumn && <th className="py-3 px-4 text-right">{compareTarget.name}</th>}
                  <th className="py-3 px-4 text-right">
                    {selectedCoop.region || "Region"} Average
                  </th>
                  <th className="py-3 px-4 text-right">National Average</th>
                  {showPeerColumn && <th className="py-3 px-4 text-right">Peer Var</th>}
                  <th className="py-3 px-4 text-right">Region Var</th>
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
                          colSpan={showPeerColumn ? 8 : 6}
                          className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-700 dark:text-slate-300"
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
                        const coopVal = getKpiValue(selectedCoop.cooperative_id, kpi);

                        let targetVal = 0;
                        if (compareTargetId === "national_average") {
                          targetVal = systemAverages[kpi.key] ?? 0;
                        } else if (compareTargetId === "region_average") {
                          targetVal = regionAverages[kpi.key] ?? 0;
                        } else {
                          targetVal = getKpiValue(compareTargetId, kpi);
                        }

                        const regionVal = regionAverages[kpi.key] ?? 0;
                        const nationalVal = systemAverages[kpi.key] ?? 0;

                        const diffPeer = coopVal - targetVal;
                        const percentDiffPeer = targetVal > 0 ? (diffPeer / targetVal) * 100 : 0;

                        const diffRegion = coopVal - regionVal;
                        const percentDiffRegion =
                          regionVal > 0 ? (diffRegion / regionVal) * 100 : 0;

                        // Direction indicators: lower is better for risk/liability-oriented metrics
                        const isPositiveIndicator = ![
                          "npl_ratio",
                          "par30",
                          "par90",
                          "dormancy_pct",
                          "arrears_rate_pct",
                          "fd_early_withdrawal_pct",
                        ].includes(kpi.key);

                        const isBetter = isPositiveIndicator ? diffPeer >= 0 : diffPeer <= 0;

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
                            <td className="py-3 px-4 text-right num text-slate-950 dark:text-white font-semibold font-mono">
                              {formatValue(coopVal, kpi.unit)}
                            </td>
                            {showPeerColumn && (
                              <td className="py-3 px-4 text-right num text-slate-800 dark:text-slate-200 font-medium font-mono">
                                {formatValue(targetVal, kpi.unit)}
                              </td>
                            )}
                            <td className="py-3 px-4 text-right num text-slate-800 dark:text-slate-200 font-medium font-mono">
                              {formatValue(regionVal, kpi.unit)}
                            </td>
                            <td className="py-3 px-4 text-right num text-slate-800 dark:text-slate-200 font-medium font-mono">
                              {formatValue(nationalVal, kpi.unit)}
                            </td>
                            {showPeerColumn && (
                              <td
                                className={`py-3 px-4 text-right num font-bold font-mono ${
                                  diffPeer === 0
                                    ? "text-slate-600 dark:text-slate-400"
                                    : isBetter
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {diffPeer > 0 ? "+" : ""}
                                {kpi.unit === "%"
                                  ? `${diffPeer.toFixed(2)}%`
                                  : formatValue(diffPeer, kpi.unit)}
                                {targetVal > 0 && (
                                  <span className="text-[9px] ml-1 opacity-70 font-normal">
                                    ({diffPeer > 0 ? "+" : ""}
                                    {percentDiffPeer.toFixed(1)}%)
                                  </span>
                                )}
                              </td>
                            )}
                            <td
                              className={`py-3 px-4 text-right num font-bold font-mono ${
                                diffRegion === 0
                                  ? "text-slate-650 dark:text-slate-405"
                                  : (isPositiveIndicator ? diffRegion >= 0 : diffRegion <= 0)
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {diffRegion > 0 ? "+" : ""}
                              {kpi.unit === "%"
                                ? `${diffRegion.toFixed(2)}%`
                                : formatValue(diffRegion, kpi.unit)}
                              {regionVal > 0 && (
                                <span className="text-[9px] ml-1 opacity-70 font-normal">
                                  ({diffRegion > 0 ? "+" : ""}
                                  {percentDiffRegion.toFixed(1)}%)
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
