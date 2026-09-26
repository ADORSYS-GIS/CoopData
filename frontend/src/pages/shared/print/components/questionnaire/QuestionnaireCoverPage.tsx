import React from "react";
import { useTranslation } from "react-i18next";

import { rateNote } from "@/lib/basic-dashboard";
import { reportCode } from "@/lib/questionnaire-report";
import type { QuestionnaireReportProps } from "./types";

export const QuestionnaireCoverPage: React.FC<QuestionnaireReportProps> = ({
  dashboard,
  submissionId,
  coopName,
}) => {
  const { t } = useTranslation();
  const { scope } = dashboard;
  const note = rateNote(scope);
  return (
    <div className="relative flex flex-col justify-between w-[210mm] h-[268mm] p-16 bg-gradient-to-br from-slate-900 to-slate-800 text-white break-after-page">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-8">
        <h2 className="text-3xl font-black tracking-widest text-slate-200 uppercase">
          {t("printReports.officialReport")}
        </h2>
        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] uppercase font-bold tracking-widest text-blue-400">
          {t("printReports.confidential")}
        </span>
      </div>

      <div className="my-auto space-y-6">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
          {t("questionnaireReport.cover.kicker")}
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight leading-tight text-white border-l-4 border-blue-500 pl-6">
          {coopName.toUpperCase()}
        </h1>
        <p className="text-lg text-slate-300 max-w-lg leading-relaxed font-light">
          {t("questionnaireReport.cover.description")}
        </p>
      </div>

      <div className="border-t border-slate-700/60 pt-8 grid grid-cols-3 gap-6 text-xs text-slate-400">
        <div>
          <p className="uppercase tracking-widest text-[10px] text-slate-500 font-bold mb-1">
            {t("questionnaireReport.cover.period")}
          </p>
          <p className="text-sm font-bold text-white">{scope.period_label || "—"}</p>
        </div>
        <div>
          <p className="uppercase tracking-widest text-[10px] text-slate-500 font-bold mb-1">
            {t("printReports.submissionCode")}
          </p>
          <p className="text-sm font-mono text-white">
            {reportCode(scope.reporting_year, submissionId)}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-widest text-[10px] text-slate-500 font-bold mb-1">
            {t("questionnaireReport.cover.currency")}
          </p>
          <p className="text-sm font-bold text-white">{scope.currency}</p>
          {note && <p className="mt-1 text-[10px] text-slate-400">{note}</p>}
        </div>
      </div>
    </div>
  );
};
