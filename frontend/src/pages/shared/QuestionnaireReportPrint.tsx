import React from "react";
import { useTranslation } from "react-i18next";

import { Spinner } from "@/components/ui/spinner";
import { useGotenbergReady } from "@/hooks/print/useGotenbergReady";
import {
  useQuestionnaireNarratives,
  useQuestionnaireReport,
} from "@/hooks/reports/useQuestionnaireReport";
import { useSubmission } from "@/hooks/submissions/useSubmissions";
import { QuestionnaireTplReport } from "./print/quest/QuestionnaireTplReport";

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

  return (
    <QuestionnaireTplReport
      dashboard={dashboard}
      submissionId={submissionId}
      coopName={submission?.cooperative_name ?? "COOPERATIVE"}
      narratives={narratives}
      apexName={submission?.apex_name}
      status={submission?.status}
    />
  );
};
