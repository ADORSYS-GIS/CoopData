import type { BasicDashboardResponse } from "@/types/basic-dashboard";
import type { QuestionnaireNarratives } from "@/types/questionnaire-report";

export interface QuestionnaireReportProps {
  dashboard: BasicDashboardResponse;
  submissionId: string;
  coopName: string;
  narratives?: QuestionnaireNarratives | null;
}
