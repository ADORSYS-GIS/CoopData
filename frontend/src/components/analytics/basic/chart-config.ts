import { useTranslation } from "react-i18next";

import { compactNumber, currencyPrefix, formatMoneyValue } from "@/lib/basic-dashboard";

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
} as const;

export const AXIS_PROPS = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const CHART_HEIGHT = 280;

export const useChartText = (chartKey: string) => {
  const { t } = useTranslation();
  return {
    title: t(`basicDashboard.charts.${chartKey}.title`),
    subtitle: t(`basicDashboard.charts.${chartKey}.subtitle`),
    info: t(`basicDashboard.charts.${chartKey}.info`),
    series: (key: string) => t(`basicDashboard.charts.series.${key}`),
  };
};

export const moneyFormatters = (currency: string) => ({
  axis: (value: number) => `${currencyPrefix(currency)}${compactNumber(value)}`,
  tooltip: (value: number) => formatMoneyValue(value, currency),
});

export const percentFormatters = {
  axis: (value: number) => `${value}%`,
  tooltip: (value: number) => `${value.toFixed(2)}%`,
};
