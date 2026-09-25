import React from "react";
import { useTranslation } from "react-i18next";

import { Spinner } from "@/components/ui/spinner";
import { useGotenbergReady } from "@/hooks/print/useGotenbergReady";
import {
  useQuestionnaireNarratives,
  useQuestionnaireReport,
} from "@/hooks/reports/useQuestionnaireReport";
import { useSubmission } from "@/hooks/submissions/useSubmissions";
import {
  QuestionnaireCoverPage,
  QuestionnaireExecutiveSummary,
  QuestionnaireLiquidityCapitalSheet,
  QuestionnaireMembershipSheet,
  QuestionnaireMethodologySheet,
  QuestionnairePortfolioSheet,
  QuestionnaireRiskSheet,
  QuestionnaireStructureSheet,
  QuestionnaireTrendsSheet,
} from "./print/components/questionnaire";

interface Props {
  submissionId: string;
  tokenOverride?: string;
}

export const QuestionnaireReportPrint: React.FC<Props> = ({ submissionId, tokenOverride }) => {
  const { t } = useTranslation();
  const { data: submission, isLoading: subLoading } = useSubmission(
    submissionId,
    undefined,
    tokenOverride,
  );
  const { data: dashboard, isLoading: reportLoading } = useQuestionnaireReport(
    submissionId,
    tokenOverride,
  );
  // Narratives are optional: the report renders factual fallbacks without them.
  const { data: narratives, isLoading: narrativesLoading } = useQuestionnaireNarratives(
    submissionId,
    tokenOverride,
  );

  const loading = subLoading || reportLoading || narrativesLoading;
  useGotenbergReady(!loading);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <Spinner size="xl" className="text-accent" />
          <p className="mt-4 text-sm font-semibold">{t("printReports.generatingLayout")}</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white p-8 text-slate-800">
        <div className="text-center">
          <p className="text-lg font-bold text-destructive">{t("printReports.failedLoad")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("printReports.failedLoadDesc")}</p>
        </div>
      </div>
    );
  }

  const props = {
    dashboard,
    submissionId,
    coopName: submission?.cooperative_name ?? "COOPERATIVE",
    narratives,
  };

  return (
    <div className="print-report bg-white text-slate-900 font-sans print:w-[210mm]">
      <QuestionnaireCoverPage {...props} />
      <QuestionnaireExecutiveSummary {...props} />
      <QuestionnaireMembershipSheet {...props} />
      <QuestionnairePortfolioSheet {...props} />
      <QuestionnaireRiskSheet {...props} />
      <QuestionnaireLiquidityCapitalSheet {...props} />
      <QuestionnaireStructureSheet {...props} />
      <QuestionnaireTrendsSheet {...props} />
      <QuestionnaireMethodologySheet {...props} />
    </div>
  );
};
