import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
  // Portfolio and membership are optional — render without them if unavailable
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

  // Wait for critical data — portfolio and membership are allowed to still load
  const criticalLoading = subLoading || kpisLoading || lineItemsLoading;
  const allLoading = criticalLoading || portfolioLoading || membershipLoading;

  if (allLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="text-center">
          <div className="size-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
          <p className="mt-4 text-sm font-semibold">{t("printReports.generatingLayout")}</p>
        </div>
      </div>
    );
  }

  // Only critical data is required — portfolio/membership degrade gracefully
  if (!submission || !kpisData || !lineItemsData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800 p-8">
        <div className="text-center">
          <p className="text-lg font-bold text-red-600">{t("printReports.failedLoad")}</p>
          <p className="text-sm text-slate-500 mt-1">{t("printReports.failedLoadDesc")}</p>
        </div>
      </div>
    );
  }

  // Provide empty fallbacks for optional data
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
    <div className="print-report bg-white text-slate-900 font-sans print:w-[210mm]">
      <ReportCoverPage {...reportData} />
      <ReportExecutiveSummary {...reportData} />
      <ReportNonFinancial {...reportData} />
      <ReportFinancialPosition {...reportData} />
      <ReportPortfolioQuality {...reportData} />
      <ReportBenchmarkComparison {...reportData} />
    </div>
  );
};
