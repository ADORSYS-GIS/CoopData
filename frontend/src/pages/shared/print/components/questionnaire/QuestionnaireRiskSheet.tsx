import React from "react";
import { useTranslation } from "react-i18next";

import {
  formatIndicatorValue,
  hasSeriesData,
  indicatorByKey,
  isNotReported,
  parTone,
  seriesToChartData,
  toneClass,
} from "@/lib/basic-dashboard";
import {
  OVERDUE_BUCKETS,
  narrativeText,
  pickIndicators,
  seriesLabelKey,
} from "@/lib/questionnaire-report";
import { INDICATOR_KEYS } from "@/types/basic-dashboard";
import { AiInsightBox } from "../AiInsightBox";
import { NoData, PrintComboChart } from "./PrintCharts";
import { IndicatorGrid, Sheet, SubHeading } from "./Sheet";
import type { QuestionnaireReportProps } from "./types";

export const QuestionnaireRiskSheet: React.FC<QuestionnaireReportProps> = ({
  dashboard,
  narratives,
}) => {
  const { t } = useTranslation();
  const { indicators, scope, series } = dashboard;
  const parKeys = ["par_gt_30_pct", "par_gt_90_pct", "portfolio_at_risk_pct"];
  const pct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <Sheet
      title={t("questionnaireReport.risk.title")}
      subtitle={scope.period_label}
      pageLabel={t("questionnaireReport.risk.page")}
    >
      <AiInsightBox
        title={t("questionnaireReport.aiInsight")}
        content={narrativeText(narratives, "portfolio_quality")}
        fallbackContent={<p>{t("questionnaireReport.risk.fallback")}</p>}
      />

      <SubHeading>{t("questionnaireReport.risk.buckets")}</SubHeading>
      <table className="w-full border-collapse text-xs page-break-inside-avoid">
        <thead>
          <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-1.5">{t("questionnaireReport.risk.bucket")}</th>
            <th className="py-1.5 text-right">{t("questionnaireReport.risk.rate")}</th>
            <th className="py-1.5 text-right">{t("questionnaireReport.risk.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {OVERDUE_BUCKETS.map((b) => {
            const rate = indicatorByKey(indicators, b.rate);
            const amount = b.amount ? indicatorByKey(indicators, b.amount) : undefined;
            return (
              <tr key={b.label} className="border-b border-slate-100">
                <td className="py-1.5">{t(`questionnaireReport.risk.bucketLabels.${b.label}`)}</td>
                <td
                  className={`py-1.5 text-right font-semibold tabular-nums ${rate && !isNotReported(rate) ? toneClass(parTone(rate.value)) : "text-slate-300"}`}
                >
                  {rate ? formatIndicatorValue(rate, scope) : "—"}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {amount ? formatIndicatorValue(amount, scope) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <SubHeading>{t("basicDashboard.charts.parTrend.title")}</SubHeading>
      {hasSeriesData(series.par_trend, parKeys) ? (
        <PrintComboChart
          data={seriesToChartData(series.par_trend, parKeys)}
          lines={parKeys.map((key) => ({
            key,
            name: t(`basicDashboard.charts.series.${seriesLabelKey(key)}`),
          }))}
          formatLeft={pct}
          height={200}
        />
      ) : (
        <NoData label={t("basicDashboard.charts.noData")} />
      )}

      <SubHeading>{t("basicDashboard.groups.risk")}</SubHeading>
      <IndicatorGrid
        indicators={pickIndicators(
          indicators,
          INDICATOR_KEYS.risk.filter((k) => !k.startsWith("par_") && !k.startsWith("var_")),
        )}
        scope={scope}
        columns={4}
        dense
      />
    </Sheet>
  );
};
