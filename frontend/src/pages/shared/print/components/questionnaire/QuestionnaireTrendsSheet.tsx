import React from "react";
import { useTranslation } from "react-i18next";

import {
  compactNumber,
  currencyPrefix,
  formatIndicatorValue,
  hasSeriesData,
  indicatorByKey,
  seriesToChartData,
} from "@/lib/basic-dashboard";
import { hasHistory, narrativeText } from "@/lib/questionnaire-report";
import { AiInsightBox } from "../AiInsightBox";
import { NoData, PrintComboChart } from "./PrintCharts";
import { Sheet, SubHeading } from "./Sheet";
import type { QuestionnaireReportProps } from "./types";

export const QuestionnaireTrendsSheet: React.FC<QuestionnaireReportProps> = ({
  dashboard,
  narratives,
}) => {
  const { t } = useTranslation();
  const { indicators, scope, series } = dashboard;
  const money = (v: number) => `${currencyPrefix(scope.currency)}${compactNumber(v)}`;
  const assets = series.asset_evolution;
  const totalAssets = indicatorByKey(indicators, "total_assets");

  return (
    <Sheet
      title={t("questionnaireReport.trends.title")}
      subtitle={scope.period_label}
      pageLabel={t("questionnaireReport.trends.page")}
    >
      <SubHeading>{t("basicDashboard.charts.assetEvolution.title")}</SubHeading>
      {totalAssets && (
        <p className="mb-2 text-xs text-slate-500">
          {t("questionnaireReport.trends.currentAssets", {
            value: formatIndicatorValue(totalAssets, scope),
            period: scope.period_label,
          })}
        </p>
      )}
      {hasSeriesData(assets, ["total_assets"]) && hasHistory(assets) ? (
        <PrintComboChart
          data={seriesToChartData(assets, ["total_assets"])}
          bars={[{ key: "total_assets", name: t("basicDashboard.indicators.total_assets") }]}
          formatLeft={money}
          height={220}
        />
      ) : (
        <NoData label={t("questionnaireReport.trends.needHistory")} />
      )}

      <SubHeading>{t("questionnaireReport.trends.outlook")}</SubHeading>
      <AiInsightBox
        title={t("questionnaireReport.aiRecommendations")}
        content={narrativeText(narratives, "outlook_recommendations")}
        fallbackContent={<p>{t("questionnaireReport.trends.fallback")}</p>}
      />
    </Sheet>
  );
};
