import type { BasicDashboardResponse } from "@/types/basic-dashboard";
import type { QuestionnaireNarratives } from "@/types/questionnaire-report";

export interface QuestionnaireReportProps {
  dashboard: BasicDashboardResponse;
  submissionId: string;
  /** The submission's reference (e.g. SUB-2025-00002). */
  reference?: string | null;
  coopName: string;
  narratives?: QuestionnaireNarratives | null;
}
