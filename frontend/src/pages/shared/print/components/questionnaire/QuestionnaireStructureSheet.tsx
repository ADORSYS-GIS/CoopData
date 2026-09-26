import React from "react";
import { useTranslation } from "react-i18next";

import {
  compactNumber,
  currencyPrefix,
  hasSeriesData,
  seriesToChartData,
} from "@/lib/basic-dashboard";
import { narrativeText, pickIndicators, seriesLabelKey } from "@/lib/questionnaire-report";
import { INDICATOR_KEYS } from "@/types/basic-dashboard";
import { AiInsightBox } from "../AiInsightBox";
import { NoData, PrintComboChart } from "./PrintCharts";
import { IndicatorGrid, Sheet, SubHeading } from "./Sheet";
import type { QuestionnaireReportProps } from "./types";

const RATIO_KEYS = ["earning_asset_ratio", "member_savings_ratio", "member_share_ratio"];

export const QuestionnaireStructureSheet: React.FC<QuestionnaireReportProps> = ({
  dashboard,
  narratives,
}) => {
  const { t } = useTranslation();
  const { indicators, scope, series } = dashboard;
  const prefix = currencyPrefix(scope.currency);
  const pct = (v: number) => `${v.toFixed(0)}%`;
  const structureKeys = [...RATIO_KEYS, "borrowed_funds_ratio"];

  return (
    <Sheet
      title={t("questionnaireReport.structure.title")}
      subtitle={scope.period_label}
      pageLabel={t("questionnaireReport.structure.page")}
    >
      <AiInsightBox
        title={t("questionnaireReport.aiInsight")}
        content={narrativeText(narratives, "financial_structure_profitability")}
        fallbackContent={<p>{t("questionnaireReport.structure.fallback")}</p>}
      />

      <SubHeading>{t("basicDashboard.charts.financialStructure.title")}</SubHeading>
      <IndicatorGrid
        indicators={pickIndicators(indicators, INDICATOR_KEYS.structure)}
        scope={scope}
        columns={3}
        dense
      />
      <div className="mt-3">
        {hasSeriesData(series.financial_structure, structureKeys) ? (
          <PrintComboChart
            data={seriesToChartData(series.financial_structure, structureKeys)}
            bars={RATIO_KEYS.map((key) => ({
              key,
              name: t(`basicDashboard.charts.series.${seriesLabelKey(key)}`),
            }))}
            lines={[
              {
                key: "borrowed_funds_ratio",
                name: t("basicDashboard.charts.series.borrowed"),
                color: "#15803d",
                secondary: true,
              },
            ]}
            formatLeft={pct}
            formatRight={(v) => `${v.toFixed(1)}%`}
            height={210}
          />
        ) : (
          <NoData label={t("basicDashboard.charts.noData")} />
        )}
      </div>

      <SubHeading>{t("basicDashboard.charts.profitability.title")}</SubHeading>
      <IndicatorGrid
        indicators={pickIndicators(indicators, INDICATOR_KEYS.profitability)}
        scope={scope}
        columns={5}
        dense
      />
      <div className="mt-3">
        {hasSeriesData(series.profitability, ["net_income"]) ? (
          <PrintComboChart
            data={seriesToChartData(series.profitability, ["net_income"])}
            lines={[
              {
                key: "net_income",
                name: t("basicDashboard.indicators.net_income"),
                color: "#1e3a8a",
              },
            ]}
            formatLeft={(v) => `${prefix}${compactNumber(v)}`}
            height={180}
          />
        ) : (
          <NoData label={t("basicDashboard.charts.noData")} />
        )}
      </div>
    </Sheet>
  );
};
