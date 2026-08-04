import { Card } from "@/components/app-shell";
import { FinancialKPIGrid } from "@/components/kpi-summary";
import { calculateFinancialKPIs } from "@/lib/kpi-calculations";
import type { BalanceSheet } from "@/lib/financial-data";
import { SAMPLE_BALANCE_SHEETS } from "@/lib/mock-data";
import { TrendingUp, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface FinancialDashboardWidgetProps {
  cooperativeId?: string;
}

export function FinancialDashboardWidget({ cooperativeId }: FinancialDashboardWidgetProps) {
  const { t } = useTranslation();
  const balanceSheet = cooperativeId
    ? SAMPLE_BALANCE_SHEETS[cooperativeId]
    : SAMPLE_BALANCE_SHEETS["sunrise-savings"];

  const kpis = balanceSheet ? calculateFinancialKPIs(balanceSheet) : null;

  if (!kpis) {
    return (
      <Card title={t("financialKpis.noData")} subtitle={t("financialKpis.noDataHint")}>
        <div className="p-8 text-center text-muted-foreground">{t("financialKpis.noDataHint")}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("financialKpis.sizeTitle")} subtitle={t("financialKpis.sizeSubtitle")}>
          <FinancialKPIGrid kpis={kpis} type="size" />
        </Card>
        <Card
          title={t("financialKpis.portfolioTitle")}
          subtitle={t("financialKpis.portfolioSubtitle")}
        >
          <FinancialKPIGrid kpis={kpis} type="portfolio" />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={t("financialKpis.profitabilityTitle")}
          subtitle={t("financialKpis.profitabilitySubtitle")}
        >
          <FinancialKPIGrid kpis={kpis} type="profitability" />
        </Card>
        <Card
          title={t("financialKpis.liquidityTitle")}
          subtitle={t("financialKpis.liquiditySubtitle")}
        >
          <FinancialKPIGrid kpis={kpis} type="liquidity" />
        </Card>
      </div>
    </div>
  );
}

interface QuickKPIStatsProps {
  cooperativeId?: string;
}

export function QuickKPIStats({ cooperativeId }: QuickKPIStatsProps) {
  const { t } = useTranslation();
  const balanceSheet = cooperativeId
    ? SAMPLE_BALANCE_SHEETS[cooperativeId]
    : SAMPLE_BALANCE_SHEETS["sunrise-savings"];

  const kpis = balanceSheet ? calculateFinancialKPIs(balanceSheet) : null;

  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <TrendingUp className="size-3" />
          <span>{t("financialKpis.roa")}</span>
        </div>
        <div
          className={`text-2xl font-bold ${kpis.roa.status === "green" ? "text-success" : kpis.roa.status === "amber" ? "text-warning-foreground" : "text-destructive"}`}
        >
          {kpis.roa.formatted}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {t("financialKpis.target", { value: ">3%" })}
        </div>
      </div>
      <div className="p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <PieChartIcon className="size-3" />
          <span>{t("financialKpis.par30")}</span>
        </div>
        <div
          className={`text-2xl font-bold ${kpis.par30.status === "green" ? "text-success" : kpis.par30.status === "amber" ? "text-warning-foreground" : "text-destructive"}`}
        >
          {kpis.par30.formatted}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {t("financialKpis.target", { value: "<5%" })}
        </div>
      </div>
      <div className="p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <BarChart3 className="size-3" />
          <span>{t("financialKpis.capitalAdequacy")}</span>
        </div>
        <div
          className={`text-2xl font-bold ${kpis.capitalAdequacyRatio.status === "green" ? "text-success" : kpis.capitalAdequacyRatio.status === "amber" ? "text-warning-foreground" : "text-destructive"}`}
        >
          {kpis.capitalAdequacyRatio.formatted}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {t("financialKpis.target", { value: ">10%" })}
        </div>
      </div>
      <div className="p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <TrendingUp className="size-3" />
          <span>{t("financialKpis.roe")}</span>
        </div>
        <div
          className={`text-2xl font-bold ${kpis.roe.status === "green" ? "text-success" : kpis.roe.status === "amber" ? "text-warning-foreground" : "text-destructive"}`}
        >
          {kpis.roe.formatted}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {t("financialKpis.target", { value: ">8%" })}
        </div>
      </div>
    </div>
  );
}

interface KPIComparisonChartProps {
  cooperativeId?: string;
}

export function KPIComparisonChart({ cooperativeId }: KPIComparisonChartProps) {
  const { t } = useTranslation();
  const balanceSheet = cooperativeId
    ? SAMPLE_BALANCE_SHEETS[cooperativeId]
    : SAMPLE_BALANCE_SHEETS["sunrise-savings"];

  const kpis = balanceSheet ? calculateFinancialKPIs(balanceSheet) : null;

  if (!kpis) return null;

  const comparisonData = [
    { name: t("financialKpis.roa"), value: kpis.roa.value, regional: 2.8, national: 3.0 },
    { name: t("financialKpis.roe"), value: kpis.roe.value, regional: 7.5, national: 8.0 },
    { name: t("financialKpis.par30"), value: kpis.par30.value, regional: 6.2, national: 5.0 },
    {
      name: t("financialKpis.car"),
      value: kpis.capitalAdequacyRatio.value,
      regional: 10.5,
      national: 10.0,
    },
    {
      name: t("financialKpis.opexRatio"),
      value: kpis.operatingExpenseRatio.value,
      regional: 5.5,
      national: 5.0,
    },
  ];

  return (
    <Card title={t("financialKpis.benchmarkTitle")} subtitle={t("financialKpis.benchmarkSubtitle")}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
              }}
            />
            <Legend />
            <Bar
              dataKey="value"
              fill="var(--primary)"
              name={t("financialKpis.yourCoop")}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="regional"
              fill="var(--chart-2)"
              name={t("financialKpis.regionalAvg")}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="national"
              fill="var(--chart-3)"
              name={t("financialKpis.nationalAvg")}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
