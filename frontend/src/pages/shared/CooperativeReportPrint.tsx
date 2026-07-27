import React, { useMemo } from "react";
import { useSubmission } from "@/hooks/submissions/useSubmissions";
import { 
  useCooperativeKpis,
  useSubmissionLineItems,
  usePortfolioBreakdown,
  useMembershipStats,
  KpiItemResponse,
} from "@/hooks/submissions/useCooperativeKpis";
import { useCooperativeProfile } from "@/hooks/cooperatives/useCooperativeProfile";
import {
  ReportCoverPage,
  ReportExecutiveSummary,
  ReportNonFinancial,
  ReportFinancialPosition,
  ReportPortfolioQuality,
  ReportBenchmarkComparison,
  ReportDataProps,
} from "./print/components";

interface Props {
  submissionId: string;
  tokenOverride?: string;
}

export const CooperativeReportPrint: React.FC<Props> = ({ submissionId, tokenOverride }) => {
  const { data: submission, isLoading: subLoading } = useSubmission(submissionId, undefined, tokenOverride);
  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(submissionId, tokenOverride);
  const { data: lineItemsData, isLoading: lineItemsLoading } = useSubmissionLineItems(submissionId, tokenOverride);
  const { data: portfolioData, isLoading: portfolioLoading } = usePortfolioBreakdown(submissionId, tokenOverride);
  const { data: membershipData, isLoading: membershipLoading } = useMembershipStats(submissionId, tokenOverride);
  const { data: cooperative, isLoading: coopLoading } = useCooperativeProfile(
    submission?.cooperative_id ?? ""
  );

  const coopName = cooperative?.name ?? "COOPERATIVE";

  const kpiMap = useMemo(() => {
    if (!kpisData) return new Map<string, KpiItemResponse>();
    return new Map(kpisData.kpis.map((k) => [k.name, k]));
  }, [kpisData]);

  if (subLoading || kpisLoading || lineItemsLoading || portfolioLoading || membershipLoading || coopLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
          <p className="mt-4 text-sm font-semibold">Generating report layout…</p>
        </div>
      </div>
    );
  }

  if (!submission || !kpisData || !lineItemsData || !portfolioData || !membershipData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800 p-8">
        <div className="text-center">
          <p className="text-lg font-bold text-red-600">Failed to load report data</p>
          <p className="text-sm text-slate-500 mt-1">Please verify the submission exists and has approved statements.</p>
        </div>
      </div>
    );
  }

  const reportData: ReportDataProps = {
    submission,
    submissionId,
    kpisData,
    lineItemsData,
    portfolioData,
    membershipData,
    cooperative,
    coopName,
    kpiMap,
  };

  return (
    <div className="bg-white text-slate-900 font-sans print:w-[210mm]">
      <ReportCoverPage {...reportData} />
      <ReportExecutiveSummary {...reportData} />
      <ReportNonFinancial {...reportData} />
      <ReportFinancialPosition {...reportData} />
      <ReportPortfolioQuality {...reportData} />
      <ReportBenchmarkComparison {...reportData} />
    </div>
  );
};
