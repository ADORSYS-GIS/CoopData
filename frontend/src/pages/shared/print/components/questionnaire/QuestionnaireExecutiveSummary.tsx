import React from "react";
import { useTranslation } from "react-i18next";

import { indicatorByKey } from "@/lib/basic-dashboard";
import { narrativeText, pickIndicators, reportedShare } from "@/lib/questionnaire-report";
import { AiInsightBox } from "../AiInsightBox";
import { IndicatorGrid, Sheet, SubHeading } from "./Sheet";
import type { QuestionnaireReportProps } from "./types";

const SUMMARY_KEYS = [
  "registered_members",
  "active_members_pct",
  "total_assets",
  "total_deposits",
  "gross_loan_portfolio",
  "par_gt_30_pct",
  "liquidity_ratio_pct",
  "institutional_capital_ratio_pct",
  "member_savings_ratio",
  "net_income",
  "return_on_assets_pct",
  "female_borrowers_pct",
] as const;

export const QuestionnaireExecutiveSummary: React.FC<QuestionnaireReportProps> = ({
  dashboard,
  narratives,
}) => {
  const { t } = useTranslation();
  const { indicators, scope, thresholds } = dashboard;
  const share = reportedShare(indicators);
  const liquidity = indicatorByKey(indicators, "liquidity_ratio_pct")?.value ?? null;
  const capital = indicatorByKey(indicators, "institutional_capital_ratio_pct")?.value ?? null;

  return (
    <Sheet
      title={t("questionnaireReport.summary.title")}
      subtitle={scope.period_label}
      pageLabel={t("questionnaireReport.summary.page")}
    >
      <AiInsightBox
        title={t("questionnaireReport.aiSummary")}
        content={narrativeText(narratives, "executive_summary")}
        fallbackContent={<p>{t("questionnaireReport.summary.fallback")}</p>}
      />
      <SubHeading>{t("questionnaireReport.summary.keyFigures")}</SubHeading>
      <IndicatorGrid
        indicators={pickIndicators(indicators, SUMMARY_KEYS)}
        scope={scope}
        columns={4}
      />

      <SubHeading>{t("questionnaireReport.summary.regulatory")}</SubHeading>
      <table className="w-full border-collapse text-xs page-break-inside-avoid">
        <thead>
          <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-1.5">{t("questionnaireReport.summary.measure")}</th>
            <th className="py-1.5 text-right">{t("questionnaireReport.summary.maintained")}</th>
            <th className="py-1.5 text-right">{t("questionnaireReport.summary.minimum")}</th>
            <th className="py-1.5 text-right">{t("questionnaireReport.summary.result")}</th>
          </tr>
        </thead>
        <tbody>
          {[
            {
              label: "liquidity_ratio_pct",
              value: liquidity,
              min: thresholds.liquidity_minimum_pct,
            },
            {
              label: "institutional_capital_ratio_pct",
              value: capital,
              min: thresholds.institutional_capital_minimum_pct,
            },
          ].map((row) => (
            <tr key={row.label} className="border-b border-slate-100">
              <td className="py-1.5">{t(`basicDashboard.indicators.${row.label}`)}</td>
              <td className="py-1.5 text-right tabular-nums">
                {row.value === null ? "—" : `${row.value.toFixed(2)}%`}
              </td>
              <td className="py-1.5 text-right tabular-nums">{row.min.toFixed(0)}%</td>
              <td
                className={`py-1.5 text-right font-bold ${row.value === null ? "text-slate-400" : row.value >= row.min ? "text-emerald-600" : "text-red-600"}`}
              >
                {row.value === null
                  ? t("basicDashboard.status.notReported")
                  : row.value >= row.min
                    ? t("questionnaireReport.summary.met")
                    : t("questionnaireReport.summary.shortfall")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[10px] text-slate-400">
        {t("questionnaireReport.summary.coverage", {
          reported: share.reported,
          total: share.total,
        })}
      </p>
    </Sheet>
  );
};
