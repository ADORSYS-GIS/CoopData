import type { TFunction } from "i18next";

import type { MetricCard } from "@/components/analytics/national/metrics";
import { isReportedKpi } from "@/lib/kpi-reported";
import type { components } from "@/openapi-client/api";

const CORE_KPI_NAMES = new Set([
  "NPL_RATIO",
  "CAPITAL_ADEQUACY_RATIO",
  "LIQUID_FUNDS_RATIO",
  "ROA",
  "ROE",
  "NET_SURPLUS",
  "PAR30",
  "OPERATING_EXPENSE_RATIO",
]);

type KpiItem = components["schemas"]["KpiItemResponse"];

const STATUS_TREND = { green: "up", red: "down" } as const;
const STATUS_TEXT = {
  green: "analytics.healthy",
  amber: "analytics.watch",
  red: "analytics.risk",
} as const;

/**
 * Regulatory KPI cards for one cooperative, coloured by their traffic-light
 * status. Without a financial statement (no total assets) every ratio is zero,
 * so the cards read "Not reported" instead of a misleading 0.0% "Risk".
 */
const kpiLabel = (kpi: KpiItem, t: TFunction): string =>
  t(`analytics.kpiName.${kpi.name.toLowerCase()}`, { defaultValue: kpi.name.replace(/_/g, " ") });

/** The backend sends English only; a translated text is used when one exists. */
const kpiHelp = (kpi: KpiItem, t: TFunction): string =>
  t(`analytics.kpiHelp.${kpi.name.toLowerCase()}`, { defaultValue: kpi.description || kpi.name });

export const buildKpiCards = (kpis: readonly KpiItem[], t: TFunction): MetricCard[] => {
  const assets = kpis.find((kpi) => kpi.name.toLowerCase() === "total_assets")?.value ?? 0;
  const reported = assets > 0;

  return kpis
    .filter((kpi) => CORE_KPI_NAMES.has(kpi.name.toUpperCase()))
    .map((kpi) => {
      const status = kpi.status as keyof typeof STATUS_TEXT | null;
      if (!reported || !isReportedKpi(kpi)) {
        return {
          key: kpi.name,
          label: kpiLabel(kpi, t),
          value: "—",
          tooltip: kpiHelp(kpi, t),
          trend: "neutral" as const,
          trendValue: t("analytics.stmt.notReported"),
        };
      }
      return {
        key: kpi.name,
        label: kpiLabel(kpi, t),
        value: kpi.formatted || String(kpi.value),
        tooltip: kpiHelp(kpi, t),
        trend:
          status && status in STATUS_TREND ? STATUS_TREND[status as "green" | "red"] : "neutral",
        trendValue: status ? t(STATUS_TEXT[status]) : t("analytics.unknown"),
      };
    });
};
