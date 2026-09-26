import React from "react";
import { useTranslation } from "react-i18next";

import { womenSharePct } from "@/lib/basic-dashboard";
import { narrativeText, pickIndicators } from "@/lib/questionnaire-report";
import { INDICATOR_KEYS } from "@/types/basic-dashboard";
import { AiInsightBox } from "../AiInsightBox";
import { PrintComboChart } from "./PrintCharts";
import { IndicatorGrid, Sheet, SubHeading } from "./Sheet";
import type { QuestionnaireReportProps } from "./types";

export const QuestionnaireMembershipSheet: React.FC<QuestionnaireReportProps> = ({
  dashboard,
  narratives,
}) => {
  const { t } = useTranslation();
  const { indicators, scope, demographics: d } = dashboard;
  const ageData = [
    { label: t("basicDashboard.demographics.age1825"), value: d.age.age_18_25 },
    { label: t("basicDashboard.demographics.age2635"), value: d.age.age_26_35 },
    { label: t("basicDashboard.demographics.age3660"), value: d.age.age_36_60 },
    { label: t("basicDashboard.demographics.age61"), value: d.age.age_61_plus },
  ];
  const committees = [
    { key: "board", counts: d.board },
    { key: "executive", counts: d.executive },
    { key: "creditCommittee", counts: d.credit_committee },
  ];

  return (
    <Sheet
      title={t("questionnaireReport.membership.title")}
      subtitle={scope.period_label}
      pageLabel={t("questionnaireReport.membership.page")}
    >
      <AiInsightBox
        title={t("questionnaireReport.aiInsight")}
        content={narrativeText(narratives, "membership_governance")}
        fallbackContent={<p>{t("questionnaireReport.membership.fallback")}</p>}
      />
      <IndicatorGrid
        indicators={pickIndicators(indicators, INDICATOR_KEYS.membership)}
        scope={scope}
        columns={4}
      />

      <SubHeading>{t("questionnaireReport.membership.gender")}</SubHeading>
      <table className="w-full border-collapse text-xs page-break-inside-avoid">
        <thead>
          <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-1.5" />
            <th className="py-1.5 text-right">{t("basicDashboard.demographics.male")}</th>
            <th className="py-1.5 text-right">{t("basicDashboard.demographics.female")}</th>
            <th className="py-1.5 text-right">{t("basicDashboard.demographics.womenShare")}</th>
          </tr>
        </thead>
        <tbody>
          {[
            { label: t("basicDashboard.demographics.registered"), counts: d.registered },
            { label: t("basicDashboard.demographics.active"), counts: d.active },
            ...committees.map((c) => ({
              label: t(`basicDashboard.demographics.${c.key}`),
              counts: c.counts,
            })),
          ].map((row) => {
            const share = womenSharePct(row.counts);
            return (
              <tr key={row.label} className="border-b border-slate-100">
                <td className="py-1.5">{row.label}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {row.counts.male.toLocaleString()}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {row.counts.female.toLocaleString()}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {share === null ? "—" : `${share.toFixed(1)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <SubHeading>{t("questionnaireReport.membership.age")}</SubHeading>
      <PrintComboChart
        data={ageData}
        bars={[{ key: "value", name: t("basicDashboard.demographics.registered") }]}
        height={190}
      />

      <SubHeading>{t("basicDashboard.groups.governance")}</SubHeading>
      <IndicatorGrid
        indicators={pickIndicators(indicators, INDICATOR_KEYS.governance)}
        scope={scope}
        columns={4}
        dense
      />
    </Sheet>
  );
};
