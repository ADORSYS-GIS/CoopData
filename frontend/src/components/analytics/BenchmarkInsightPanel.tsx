import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from "lucide-react";
import { Card } from "@/components/app-shell";
import type { KpiItemResponse } from "@/hooks/submissions/useCooperativeKpis";
import type { BenchmarkResponse } from "@/hooks/analytics/useBenchmarks";
import { useTranslation } from "react-i18next";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

// ── Types ────────────────────────────────────────────────────────────────────

type InsightSeverity = "positive" | "warning" | "critical";

interface Insight {
  kpiName: string;
  displayName: string;
  coopValue: number;
  coopFormatted: string;
  benchmarkValue: number;
  pctDiff: number;
  direction: "above" | "below";
  severity: InsightSeverity;
  message: string;
  suggestion: string;
}

interface Props {
  kpis: KpiItemResponse[];
  benchmarks: BenchmarkResponse[];
  cooperativeType?: string;
  isLoading?: boolean;
}

/** KPIs where a lower value is better (e.g. delinquency, cost ratios). */
const LOWER_IS_BETTER = new Set(["par30", "par90", "npl_ratio", "operating_expense_ratio"]);

// ── Pure insight generation ───────────────────────────────────────────────────

export function generateInsights(
  kpis: KpiItemResponse[],
  benchmarks: BenchmarkResponse[],
  t?: TranslateFn,
): Insight[] {
  const insights: Insight[] = [];
  const tr: TranslateFn =
    t ??
    ((key: string, options?: Record<string, unknown>) => {
      if (options?.defaultValue) return String(options.defaultValue);
      // Map default fallback values for testing
      if (key.includes("aboveDirection")) return "above";
      if (key.includes("belowDirection")) return "below";
      if (key.includes("message")) {
        const match = key.match(
          /Your (.*) is (.*), (.*)% (above|below) the sector average of (.*)\./,
        );
        return options
          ? `Your ${options.displayName} is ${options.coopVal}, ${options.pctDiff}% ${options.direction} the sector average of ${options.benchVal}.`
          : key;
      }
      return key;
    });

  for (const kpi of kpis) {
    const bench = benchmarks.find((b) => b.kpi_name === kpi.name);
    if (!bench || bench.sample_count === 0) continue;

    const benchmarkValue = bench.sector_average;
    if (benchmarkValue === 0) continue;

    const diff = kpi.value - benchmarkValue;
    const pctDiff = Math.abs(diff / benchmarkValue) * 100;

    // Skip near-zero differences — not actionable
    if (pctDiff < 5) continue;

    const direction: "above" | "below" = diff > 0 ? "above" : "below";
    const lowerIsBetter = LOWER_IS_BETTER.has(kpi.name);

    // Determine severity based on whether the deviation is good or bad
    const isPositiveDeviation = lowerIsBetter ? direction === "below" : direction === "above";
    const severity: InsightSeverity = isPositiveDeviation
      ? "positive"
      : pctDiff > 25
        ? "critical"
        : "warning";

    const displayName = tr(`insights.kpis.${kpi.name}`, { defaultValue: kpi.name });
    const suggestion = tr(`insights.suggestions.${kpi.name}.${direction}`, {
      defaultValue:
        direction === "above"
          ? tr("insights.suggestions.default.above")
          : tr("insights.suggestions.default.below"),
    });

    // Format benchmark for display
    const benchFormatted =
      kpi.unit === "percent"
        ? `${benchmarkValue.toFixed(1)}%`
        : kpi.unit === "currency"
          ? `$${(benchmarkValue / 1_000_000).toFixed(1)}M`
          : benchmarkValue.toFixed(2);

    insights.push({
      kpiName: kpi.name,
      displayName,
      coopValue: kpi.value,
      coopFormatted: kpi.formatted,
      benchmarkValue,
      pctDiff,
      direction,
      severity,
      message: tr("insights.message", {
        displayName,
        coopVal: kpi.formatted,
        pctDiff: pctDiff.toFixed(1),
        direction:
          direction === "above" ? tr("insights.aboveDirection") : tr("insights.belowDirection"),
        benchVal: benchFormatted,
      }),
      suggestion,
    });
  }

  // Sort: critical first, then warning, then positive
  const severityOrder: Record<InsightSeverity, number> = { critical: 0, warning: 1, positive: 2 };
  return insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<InsightSeverity, { bg: string; text: string; border: string }> = {
  positive: {
    bg: "bg-success/8",
    text: "text-success",
    border: "border-success/20",
  },
  warning: {
    bg: "bg-warning/10",
    text: "text-warning-foreground",
    border: "border-warning/30",
  },
  critical: {
    bg: "bg-destructive/8",
    text: "text-destructive",
    border: "border-destructive/20",
  },
};

const SeverityIcon = ({ severity }: { severity: InsightSeverity }) => {
  const cls = `size-4 shrink-0 ${SEVERITY_STYLES[severity].text}`;
  if (severity === "positive") return <TrendingUp className={cls} />;
  if (severity === "critical") return <AlertTriangle className={cls} />;
  return <TrendingDown className={cls} />;
};

const InsightRow = ({ insight }: { insight: Insight }) => {
  const { t } = useTranslation();
  const styles = SEVERITY_STYLES[insight.severity];
  const barPct = Math.min((insight.coopValue / (insight.benchmarkValue * 1.5)) * 100, 100);
  const benchPct = Math.min((insight.benchmarkValue / (insight.benchmarkValue * 1.5)) * 100, 100);

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4 space-y-2.5`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-lg p-1.5 ${styles.bg} ${styles.border} border`}>
          <SeverityIcon severity={insight.severity} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{insight.message}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.suggestion}</p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles.bg} ${styles.text} border ${styles.border}`}
        >
          {insight.direction === "above" ? t("insights.aboveLabel") : t("insights.belowLabel")}
        </span>
      </div>

      {/* Comparison bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <span>{t("insights.yourValue")}</span>
          <span>{t("insights.sectorAvg")}</span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${styles.text} opacity-80`}
            style={{ width: `${barPct}%`, background: "currentColor" }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/40"
            style={{ left: `${benchPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-bold num">
          <span className={styles.text}>{insight.coopFormatted}</span>
          <span className="text-muted-foreground">
            {insight.benchmarkValue.toFixed(1)}
            {insight.coopFormatted.includes("%") ? "%" : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="rounded-xl border border-border bg-muted/30 p-4 animate-pulse">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
        <div className="mt-3 h-2 bg-muted rounded" />
      </div>
    ))}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const INITIAL_VISIBLE = 3;

export function BenchmarkInsightPanel({
  kpis,
  benchmarks,
  cooperativeType,
  isLoading = false,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const insights = generateInsights(kpis, benchmarks, t);
  const showAll = expanded;
  const visibleInsights = showAll ? insights : insights.slice(0, INITIAL_VISIBLE);
  const hiddenCount = showAll ? 0 : insights.length - INITIAL_VISIBLE;

  return (
    <Card
      title={t("insights.title")}
      subtitle={
        cooperativeType
          ? t("insights.comparePeers", { type: cooperativeType.toUpperCase() })
          : t("insights.comparePeersFallback")
      }
      action={
        insights.length > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {insights.length === 1
              ? t("insights.insightCount", { count: 1 })
              : t("insights.insightCount_plural", { count: insights.length })}
          </span>
        )
      }
    >
      {isLoading ? (
        <LoadingSkeleton />
      ) : benchmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-3">
          <BarChart2 className="size-10 opacity-30" />
          <div>
            <p className="text-sm font-semibold">{t("insights.noBenchmark")}</p>
            <p className="text-xs mt-1">{t("insights.noBenchmarkDesc")}</p>
          </div>
        </div>
      ) : insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-3">
          <TrendingUp className="size-10 text-success opacity-60" />
          <div>
            <p className="text-sm font-semibold text-success">{t("insights.inLine")}</p>
            <p className="text-xs mt-1">{t("insights.inLineDesc")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleInsights.map((insight) => (
            <InsightRow key={insight.kpiName} insight={insight} />
          ))}

          {hiddenCount > 0 && (
            <button
              data-testid="insight-expander"
              onClick={() => setExpanded((v) => !v)}
              className="press-feedback w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3.5" /> {t("insights.showLess")}
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" />{" "}
                  {t("insights.seeAll", { count: insights.length })}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
