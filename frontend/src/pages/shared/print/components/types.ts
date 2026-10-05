import {
  SubmissionKpisResponse,
  SubmissionLineItemsResponse,
  PortfolioBreakdownResponse,
  MembershipStatsResponse,
  KpiItemResponse,
} from "@/hooks/submissions/useCooperativeKpis";
import type { components } from "@/openapi-client/api";
import { SubmissionResponse } from "@/hooks/submissions/useSubmissions";
import type { CoopKpiRow, NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import type { NfStatisticsResponse } from "@/hooks/analytics/useNfStatistics";
import type { PeriodSeriesPoint } from "@/hooks/analytics/usePeriodSeries";
import { CooperativeNarratives } from "@/hooks/submissions/useSubmissionNarratives";

type CooperativeResponse = components["schemas"]["CooperativeResponse"];

export type { NationalOverviewResponse };
export type { CoopKpiRow };

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
  narratives?: CooperativeNarratives | null;
  /** Statement totals per period, oldest first, ending at the reporting period. */
  trend?: readonly PeriodSeriesPoint[];
  /** Member-ledger statistics for the reporting period. */
  nfStats?: NfStatisticsResponse | null;
  /** Every cooperative with its indicators for the year, for the peer comparison. */
  peers?: readonly CoopKpiRow[];
}
