import React, { useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useSubmission } from "@/hooks/submissions/useSubmissions";
import {
  useCooperativeKpis,
  useSubmissionLineItems,
  usePortfolioBreakdown,
  useMembershipStats,
  KpiItemResponse,
  PortfolioBreakdownResponse,
  MembershipStatsResponse,
} from "@/hooks/submissions/useCooperativeKpis";
import { useSubmissionNarratives } from "@/hooks/submissions/useSubmissionNarratives";
import { useGotenbergReady } from "@/hooks/print/useGotenbergReady";
import {
  ReportCoverPage,
  ReportExecutiveSummary,
  ReportNonFinancial,
  ReportFinancialPosition,
  ReportDataProps,
} from "./print/components";

// Import the global print stylesheet — owns @page margin-boxes, fonts,
// colour palette and all rp-* utility classes.
import "./print/print-report.css";

interface Props {
  submissionId: string;
  tokenOverride?: string;
}

export const CooperativeReportPrint: React.FC<Props> = ({ submissionId, tokenOverride }) => {
  const { data: submission, isLoading: subLoading } = useSubmission(
    submissionId,
    undefined,
    tokenOverride,
  );
  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(
    submissionId,
    tokenOverride,
  );
  const { data: lineItemsData, isLoading: lineItemsLoading } = useSubmissionLineItems(
    submissionId,
    tokenOverride,
  );
  const { data: portfolioData, isLoading: portfolioLoading } = usePortfolioBreakdown(
    submissionId,
    tokenOverride,
  );
  const { data: membershipData, isLoading: membershipLoading } = useMembershipStats(
    submissionId,
    tokenOverride,
  );
  const { data: narratives } = useSubmissionNarratives(submissionId, tokenOverride);

  const coopName = submission?.cooperative_name ?? "COOPERATIVE";

  const kpiMap = useMemo(() => {
    if (!kpisData) return new Map<string, KpiItemResponse>();
    return new Map(kpisData.kpis.map((k) => [k.name, k]));
  }, [kpisData]);

  const criticalLoading = subLoading || kpisLoading || lineItemsLoading;
  const allLoading = criticalLoading || portfolioLoading || membershipLoading;

  useGotenbergReady(!allLoading);

  if (allLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <Spinner size="xl" className="text-accent" />
          <p className="mt-4 text-sm font-semibold">Generating report layout…</p>
        </div>
      </div>
    );
  }

  if (!submission || !kpisData || !lineItemsData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800 p-8">
        <div className="text-center">
          <p className="text-lg font-bold text-destructive">Failed to load report data.</p>
          <p className="text-sm text-slate-500 mt-1">
            One or more required data sources could not be fetched.
          </p>
        </div>
      </div>
    );
  }

  const safePortfolioData: PortfolioBreakdownResponse = portfolioData ?? {
    submission_id: submissionId,
    categories: [],
  };
  const safeMembershipData: MembershipStatsResponse = membershipData ?? {
    submission_id: submissionId,
    male_members: 0,
    female_members: 0,
    youth_members: 0,
    active_members: 0,
    inactive_members: 0,
    agm_attendance: 0,
  };

  const subRef = `SUB-${submission.reporting_year}-${submissionId.slice(0, 5).toUpperCase()}`;
  const coopYear = `${coopName}  ·  FY ${submission.reporting_year}`;

  const reportData: ReportDataProps = {
    submission,
    submissionId,
    kpisData,
    lineItemsData,
    portfolioData: safePortfolioData,
    membershipData: safeMembershipData,
    coopName,
    kpiMap,
    narratives,
  };

  return (
    /*
     * data-coop-year  → injected into @top-right margin box via CSS attr()
     * data-sub-ref    → injected into @bottom-center margin box via CSS attr()
     * These attributes replace the old Gotenberg-injected header/footer HTML.
     */
    <div
      className="print-report"
      data-coop-year={coopYear}
      data-sub-ref={subRef}
    >
      {/* Section order must match the numbered sections exactly */}
      <ReportCoverPage {...reportData} />          {/* Cover  */}
      <ReportExecutiveSummary {...reportData} />   {/* § 1   */}
      <ReportFinancialPosition {...reportData} />  {/* § 2, 3, 4 */}
      <ReportNonFinancial {...reportData} />       {/* § 5, 6, Annex */}
    </div>
  );
};
