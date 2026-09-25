import React from "react";
import { useTranslation } from "react-i18next";

import { hasSeriesData, seriesToChartData } from "@/lib/basic-dashboard";
import { narrativeText, pickIndicators } from "@/lib/questionnaire-report";
import { INDICATOR_KEYS } from "@/types/basic-dashboard";
import { AiInsightBox } from "../AiInsightBox";
import { NoData, PrintComboChart } from "./PrintCharts";
import { IndicatorGrid, Sheet, SubHeading } from "./Sheet";
import type { QuestionnaireReportProps } from "./types";

export const QuestionnaireLiquidityCapitalSheet: React.FC<QuestionnaireReportProps> = ({
  dashboard,
  narratives,
}) => {
  const { t } = useTranslation();
  const { indicators, scope, series } = dashboard;
  const pct = (v: number) => `${v.toFixed(0)}%`;
  const liquidityKeys = ["maintained_pct", "minimum_pct", "gap_pct"];
  const capitalKeys = ["ratio_pct", "minimum_pct", "excess_pct"];

  return (
    <Sheet
      title={t("questionnaireReport.liquidity.title")}
      subtitle={scope.period_label}
      pageLabel={t("questionnaireReport.liquidity.page")}
    >
      <AiInsightBox
        title={t("questionnaireReport.aiInsight")}
        content={narrativeText(narratives, "liquidity_capital")}
        fallbackContent={<p>{t("questionnaireReport.liquidity.fallback")}</p>}
      />

      <SubHeading>{t("basicDashboard.charts.liquidity.title")}</SubHeading>
      <IndicatorGrid
        indicators={pickIndicators(indicators, INDICATOR_KEYS.liquidity)}
        scope={scope}
        columns={4}
        dense
      />
      <div className="mt-3">
        {hasSeriesData(series.liquidity, liquidityKeys) ? (
          <PrintComboChart
            data={seriesToChartData(series.liquidity, liquidityKeys)}
            bars={[
              { key: "maintained_pct", name: t("basicDashboard.charts.series.maintained") },
              {
                key: "minimum_pct",
                name: t("basicDashboard.charts.series.minimum"),
                color: "#c8a24b",
              },
            ]}
            lines={[
              {
                key: "gap_pct",
                name: t("basicDashboard.charts.series.gap"),
                color: "#15803d",
                secondary: true,
              },
            ]}
            formatLeft={pct}
            formatRight={pct}
            height={200}
          />
        ) : (
          <NoData label={t("basicDashboard.charts.noData")} />
        )}
      </div>

      <SubHeading>{t("basicDashboard.charts.institutionalCapital.title")}</SubHeading>
      <IndicatorGrid
        indicators={pickIndicators(indicators, INDICATOR_KEYS.capital)}
        scope={scope}
        columns={4}
        dense
      />
      <div className="mt-3">
        {hasSeriesData(series.institutional_capital, capitalKeys) ? (
          <PrintComboChart
            data={seriesToChartData(series.institutional_capital, capitalKeys)}
            bars={[
              { key: "ratio_pct", name: t("basicDashboard.charts.series.capital") },
              {
                key: "minimum_pct",
                name: t("basicDashboard.charts.series.minimum"),
                color: "#c8a24b",
              },
            ]}
            lines={[
              {
                key: "excess_pct",
                name: t("basicDashboard.charts.series.excess"),
                color: "#15803d",
                secondary: true,
              },
            ]}
            formatLeft={pct}
            formatRight={pct}
            height={200}
          />
        ) : (
          <NoData label={t("basicDashboard.charts.noData")} />
        )}
      </div>
    </Sheet>
  );
};
