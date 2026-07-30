import {
  SubmissionKpisResponse,
  SubmissionLineItemsResponse,
  PortfolioBreakdownResponse,
  MembershipStatsResponse,
  KpiItemResponse,
} from "@/hooks/submissions/useCooperativeKpis";
import type { components } from "@/openapi-client/api";
import { SubmissionResponse } from "@/hooks/submissions/useSubmissions";
import type { NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";

type CooperativeResponse = components["schemas"]["CooperativeResponse"];

export type { NationalOverviewResponse };
export type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";

export interface ReportDataProps {
  submission: SubmissionResponse;
  submissionId: string;
  kpisData: SubmissionKpisResponse;
  lineItemsData: SubmissionLineItemsResponse;
  portfolioData: PortfolioBreakdownResponse;
  membershipData: MembershipStatsResponse;
  cooperative?: CooperativeResponse;
  coopName: string;
  kpiMap: Map<string, KpiItemResponse>;
}
