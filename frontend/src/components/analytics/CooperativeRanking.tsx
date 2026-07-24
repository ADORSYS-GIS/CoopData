import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
} from "recharts";
import {
  useNationalOverview,
  type NationalOverviewParams,
} from "@/hooks/analytics/useNationalOverview";
import { useComparativeStatements } from "@/hooks/analytics/useComparativeStatements";
import { Card } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Info } from "lucide-react";

interface CooperativeRankingProps {
  reportingYear: number;
  filterParams?: NationalOverviewParams;
}

const MONTH_OPTIONS = [
  { value: "all", label: "Year Total" },
  { value: "1", label: "31. Jan " },
  { value: "2", label: "28. Feb " },
  { value: "3", label: "31. Mar " },
  { value: "4", label: "30. Apr " },
  { value: "5", label: "31. May " },
  { value: "6", label: "30. Jun " },
  { value: "7", label: "31. Jul " },
  { value: "8", label: "31. Aug " },
  { value: "9", label: "30. Sep " },
  { value: "10", label: "31. Oct " },
  { value: "11", label: "30. Nov " },
  { value: "12", label: "31. Dec " },
];

const ACCOUNT_METRICS = [
  { key: "1999", label: "TOTAL ASSETS", isRawCode: true, unit: "SZL" },
  { key: "1200", label: "GROSS LOANS", isRawCode: true, unit: "SZL" },
  { key: "1100", label: "LIQUID ASSETS", isRawCode: true, unit: "SZL" },
  { key: "1300", label: "OTHER ASSETS", isRawCode: true, unit: "SZL" },
  { key: "2100", label: "MEMBER DEPOSITS", isRawCode: true, unit: "SZL" },
  { key: "2999", label: "TOTAL LIABILITIES", isRawCode: true, unit: "SZL" },
  { key: "3999", label: "TOTAL EQUITY", isRawCode: true, unit: "SZL" },
];

export function CooperativeRanking({ reportingYear, filterParams }: CooperativeRankingProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("12");
  const [selectedMetric, setSelectedMetric] = useState<string>("1999");

  // Fetch KPI dataset scoped by filters
  const { data: overview, isLoading: isOverviewLoading } = useNationalOverview({
    reportingYear,
    ...filterParams,
  });

  // Derive cooperative IDs from filtered overview for line-item fetch
  const cooperativeIds = useMemo(() => {
    if (!overview?.cooperatives?.length) return undefined;
    return overview.cooperatives.map((c) => c.cooperative_id).join(",");
  }, [overview?.cooperatives]);

  // Fetch raw comparative statement line items (scoped to filtered coops)
  const { data: comparative, isLoading: isCompLoading } = useComparativeStatements(
    { reportingYear, cooperativeIds },
    !!cooperativeIds,
  );

  const activeMetricInfo = useMemo(() => {
    return ACCOUNT_METRICS.find((m) => m.key === selectedMetric);
  }, [selectedMetric]);

  const rawDataList = useMemo(() => {
    if (!comparative?.grids) return [];

    return comparative.grids.map((grid) => {
      const lineItems = grid.line_items || [];

      // Filter by selected month if not "all"
      const filtered =
        selectedMonth === "all"
          ? lineItems
          : lineItems.filter((item) => String(item.month) === selectedMonth);

      // Sum values for the selected metric code
      const targetCode = parseInt(selectedMetric, 10);
      const sum = filtered
        .filter((item) => item.account_code === targetCode)
        .reduce((acc, curr) => acc + curr.value, 0);

      return {
        cooperative_id: grid.cooperative_id,
        name: grid.cooperative_name,
        value: sum,
        region:
          overview?.cooperatives.find((c) => c.cooperative_id === grid.cooperative_id)?.region ??
          "Unknown",
        status: "healthy",
      };
    });
  }, [comparative, selectedMonth, selectedMetric, overview]);

  const dataList = useMemo(() => {
    return rawDataList;
  }, [rawDataList]);

  // Compute total sum of all cooperative values for percentage calculations
  const totalSum = useMemo(() => {
    return dataList.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  }, [dataList]);

  // Sort and limit cooperatives
  const rankedCoops = useMemo(() => {
    const list = [...dataList];
    list.sort((a, b) => b.value - a.value);
    return list;
  }, [dataList]);

  // Formatting helper
  const formatValue = (val: number) => {
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Chart data mapping
  const chartData = useMemo(() => {
    return rankedCoops.map((c) => ({
      name: c.name.length > 20 ? `${c.name.substring(0, 20)}...` : c.name,
      fullName: c.name,
      value: c.value / 1_000_000, // Millions
    }));
  }, [rankedCoops]);

  if (isOverviewLoading || isCompLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        Loading rankings and comparative sheets...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Excel Blue Banner with Slicers */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-950 text-white rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-blue-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Financial Statistics of the Cooperative Sector
          </h2>
          <p className="text-xs text-blue-200/80 mt-1 font-medium">
            Financial Statements Bulletin — Segment 1 ({reportingYear})
          </p>
        </div>

        {/* Slicers Section */}
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 border border-white/10 min-w-[120px]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
              Date
            </span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full bg-white text-slate-900 border-0 h-8 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs font-medium">
                    {m.label}
                    {m.value !== "all" && reportingYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-2.5 border border-white/10 min-w-[200px]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
              Account
            </span>
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-full bg-white text-slate-900 border-0 h-8 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key} className="text-xs font-medium">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Info Explanation Card */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 flex gap-3 text-xs leading-relaxed shadow-sm">
        <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">Account Ranking Mapping:</span>
          The comparative ranking aggregates the raw balance sheet items based on standard account
          codes:
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li>
              <strong>Total Assets</strong>: Account code 1999.
            </li>
            <li>
              <strong>Gross Loans</strong>: Account code 1200.
            </li>
            <li>
              <strong>Liquid Assets</strong>: Account code 1100.
            </li>
            <li>
              <strong>Other Assets</strong>: Account code 1300.
            </li>
            <li>
              <strong>Member Deposits</strong>: Account code 2100.
            </li>
            <li>
              <strong>Total Liabilities</strong>: Account code 2999.
            </li>
            <li>
              <strong>Total Equity</strong>: Account code 3999.
            </li>
          </ul>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Table on the Left */}
        <div className="lg:col-span-2">
          <Card
            title="Cooperative Contribution Shares"
            subtitle="Spreadsheet breakdown of principal accounts"
          >
            {rankedCoops.length > 0 ? (
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/20">
                      <th className="py-2.5 px-3">Entity</th>
                      <th className="py-2.5 px-3 text-right">Value (SZL/USD)</th>
                      <th className="py-2.5 px-3 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rankedCoops.map((coop) => {
                      const contribPct =
                        totalSum > 0 ? (Math.max(0, coop.value) / totalSum) * 100 : 0;

                      return (
                        <tr
                          key={coop.cooperative_id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-semibold text-foreground truncate max-w-[180px]">
                            {coop.name}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {formatValue(coop.value)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-blue-600 bg-blue-50/30">
                            {contribPct.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No cooperatives found.
              </div>
            )}
          </Card>
        </div>

        {/* Bar Chart on the Right */}
        <div className="lg:col-span-3">
          <Card
            title="Ranking of Principal Accounts"
            subtitle="Value contribution of each cooperative (SZL/USD millions)"
          >
            {chartData.length > 0 ? (
              <div className="h-[430px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 65 }}>
                    <defs>
                      <linearGradient id="rankingBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis
                      dataKey="name"
                      stroke="currentColor"
                      fontSize={9}
                      opacity={0.8}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={75}
                    />
                    <YAxis stroke="currentColor" fontSize={10} opacity={0.8} />
                    <ChartTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(val: unknown) => [
                        `${Number(val).toFixed(2)}M`,
                        "Value (Millions)",
                      ]}
                    />
                    <Bar dataKey="value" fill="url(#rankingBarGrad)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[380px] items-center justify-center text-muted-foreground text-xs">
                No statement data matches your selections.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
