import React from "react";
import { useTranslation } from "react-i18next";

import { formatIndicatorValue, isNotReported } from "@/lib/basic-dashboard";
import { methodologyIndicators, reportedShare } from "@/lib/questionnaire-report";
import { Sheet } from "./Sheet";
import type { QuestionnaireReportProps } from "./types";

export const QuestionnaireMethodologySheet: React.FC<QuestionnaireReportProps> = ({
  dashboard,
}) => {
  const { t } = useTranslation();
  const { indicators, scope } = dashboard;
  const flagged = methodologyIndicators(indicators);
  const share = reportedShare(indicators);

  return (
    <Sheet
      title={t("questionnaireReport.methodology.title")}
      subtitle={scope.period_label}
      pageLabel={t("questionnaireReport.methodology.page")}
    >
      <p className="mb-4 text-xs leading-relaxed text-slate-600">
        {t("questionnaireReport.methodology.intro", {
          reported: share.reported,
          total: share.total,
        })}
      </p>
      {flagged.length === 0 ? (
        <p className="text-xs text-emerald-700">
          {t("questionnaireReport.methodology.allComputed")}
        </p>
      ) : (
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-slate-300 text-left uppercase tracking-wider text-slate-500">
              <th className="py-1.5">{t("questionnaireReport.methodology.indicator")}</th>
              <th className="py-1.5">{t("questionnaireReport.methodology.status")}</th>
              <th className="py-1.5 text-right">{t("questionnaireReport.methodology.value")}</th>
              <th className="py-1.5 pl-3">{t("questionnaireReport.methodology.formula")}</th>
              <th className="py-1.5">{t("questionnaireReport.methodology.fields")}</th>
            </tr>
          </thead>
          <tbody>
            {flagged.map((i) => (
              <tr
                key={i.key}
                className="border-b border-slate-100 align-top page-break-inside-avoid"
              >
                <td className="py-1.5 pr-2 font-semibold">
                  {t(`basicDashboard.indicators.${i.key}`)}
                </td>
                <td
                  className={`py-1.5 pr-2 ${isNotReported(i) ? "text-slate-400" : "text-amber-600"}`}
                >
                  {isNotReported(i)
                    ? t("basicDashboard.status.notReported")
                    : t("basicDashboard.status.approximate")}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {formatIndicatorValue(i, scope)}
                </td>
                <td className="py-1.5 pl-3 pr-2 text-slate-600">
                  {i.formula}
                  {i.note && <span className="block text-slate-400">{i.note}</span>}
                </td>
                <td className="py-1.5 font-mono text-[9px] text-slate-500">
                  {i.sources.join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-6 text-[10px] leading-relaxed text-slate-400">
        {t("questionnaireReport.methodology.notes")}
      </p>
    </Sheet>
  );
};
