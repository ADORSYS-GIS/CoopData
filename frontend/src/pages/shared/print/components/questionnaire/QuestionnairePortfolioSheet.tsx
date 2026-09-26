import React from "react";
import { useTranslation } from "react-i18next";

import {
  hasSeriesData,
  seriesToChartData,
  compactNumber,
  currencyPrefix,
} from "@/lib/basic-dashboard";
import { PANEL_INDICATOR_KEYS, narrativeText, pickIndicators } from "@/lib/questionnaire-report";
import { AiInsightBox } from "../AiInsightBox";
import { NoData, PrintComboChart } from "./PrintCharts";
import { IndicatorGrid, Sheet, SubHeading } from "./Sheet";
import type { QuestionnaireReportProps } from "./types";

export const QuestionnairePortfolioSheet: React.FC<QuestionnaireReportProps> = ({
  dashboard,
  narratives,
}) => {
  const { t } = useTranslation();
  const { indicators, scope, series } = dashboard;
  const prefix = currencyPrefix(scope.currency);
  const money = (v: number) => `${prefix}${compactNumber(v)}`;
  const trend = series.loan_portfolio;
  const savings = series.savings_trend;

  return (
    <Sheet
      title={t("questionnaireReport.portfolio.title")}
      subtitle={scope.period_label}
      pageLabel={t("questionnaireReport.portfolio.page")}
    >
      <AiInsightBox
        title={t("questionnaireReport.aiInsight")}
        content={narrativeText(narratives, "portfolio_quality")}
        fallbackContent={<p>{t("questionnaireReport.portfolio.fallback")}</p>}
      />
      <SubHeading>{t("questionnaireReport.portfolio.panel")}</SubHeading>
      <IndicatorGrid
        indicators={pickIndicators(indicators, PANEL_INDICATOR_KEYS)}
        scope={scope}
        columns={5}
        dense
      />
      <p className="mt-2 text-[10px] text-slate-400">{t("questionnaireReport.portfolio.legend")}</p>

      <SubHeading>{t("basicDashboard.charts.loanPortfolio.title")}</SubHeading>
      {hasSeriesData(trend, ["gross_loans"]) ? (
        <PrintComboChart
          data={seriesToChartData(trend, ["gross_loans"])}
          bars={[{ key: "gross_loans", name: t("basicDashboard.indicators.gross_loan_portfolio") }]}
          formatLeft={money}
          height={170}
        />
      ) : (
        <NoData label={t("basicDashboard.charts.noData")} />
      )}
      <SubHeading>{t("basicDashboard.charts.savingsTrend.title")}</SubHeading>
      {hasSeriesData(savings, ["total_deposits"]) ? (
        <PrintComboChart
          data={seriesToChartData(savings, ["total_deposits"])}
          bars={[
            {
              key: "total_deposits",
              name: t("basicDashboard.indicators.total_deposits"),
              color: "#c8a24b",
            },
          ]}
          formatLeft={money}
          height={170}
        />
      ) : (
        <NoData label={t("basicDashboard.charts.noData")} />
      )}
    </Sheet>
  );
};
