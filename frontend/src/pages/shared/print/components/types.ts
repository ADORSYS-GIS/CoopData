import {
  SubmissionKpisResponse,
  SubmissionLineItemsResponse,
  PortfolioBreakdownResponse,
  MembershipStatsResponse,
  KpiItemResponse,
} from "@/hooks/submissions/useCooperativeKpis";
import type { components } from "@/openapi-client/api";
import { SubmissionResponse } from "@/hooks/submissions/useSubmissions";

type CooperativeResponse = components["schemas"]["CooperativeResponse"];

export interface CoopKpiRow {
  name?: string;
  apex_name?: string;
  sector?: string;
  has_data: boolean;
  kpis: Record<string, { value: number }>;
  non_financial: Record<string, number>;
}

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
