import type { TFunction } from "i18next";

import type { MetricCard, MetricGroup, Trend } from "@/components/analytics/national/metrics";
import { formatUsd } from "@/lib/currency";
import {
  INDICATOR_GROUPS,
  buildStatementIndicators,
  type StatementIndicator,
  type StatementPoint,
} from "@/lib/statement-indicators";

const NOISE = 0.05;

const formatValue = (indicator: StatementIndicator, value: number): string => {
  if (indicator.unit === "usd") return formatUsd(value, 0);
  return `${value.toFixed(indicator.unit === "pct2" ? 2 : 1)}%`;
};

const signed = (value: number, digits: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;

const trendOf = (indicator: StatementIndicator): Trend => {
  const { change, higherIsBetter } = indicator;
  if (change === null || Math.abs(change) < NOISE || higherIsBetter === null) return "neutral";
  return change > 0 === higherIsBetter ? "up" : "down";
};

const cardFor = (indicator: StatementIndicator, t: TFunction): MetricCard => {
  const base = {
    key: indicator.key,
    label: t(`analytics.stmt.label.${indicator.key}`),
    tooltip: t(`analytics.stmt.tip.${indicator.key}`),
  };
  if (indicator.value === null) {
    return { ...base, value: "—", trend: "neutral", trendValue: t("analytics.stmt.notReported") };
  }
  const value = formatValue(indicator, indicator.value);
  if (indicator.change === null) return { ...base, value };

  const isMoney = indicator.unit === "usd";
  return {
    ...base,
    value,
    trend: trendOf(indicator),
    trendValue: t(isMoney ? "analytics.stmt.vsPrevious" : "analytics.stmt.vsPreviousPp", {
      change: isMoney ? `${signed(indicator.change, 1)}%` : signed(indicator.change, 2),
    }),
  };
};

/**
 * Statement-based indicators grouped like Basic Analytics, each compared with
 * the previous period of the same frequency.
 */
export const buildStatementGroups = (
  points: readonly StatementPoint[],
  t: TFunction,
): MetricGroup[] => {
  const current = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : undefined;
  const indicators = buildStatementIndicators(current, previous);

  return INDICATOR_GROUPS.map((group) => ({
    id: `stmt-${group}`,
    title: t(`analytics.stmt.group.${group}`),
    metrics: indicators.filter((i) => i.group === group).map((i) => cardFor(i, t)),
  }));
};
