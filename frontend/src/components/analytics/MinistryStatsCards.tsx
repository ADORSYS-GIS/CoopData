import { MetricsGridCards } from "@/components/analytics/MetricsGridCards";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { useMinistryStats, type MinistryStatsParams } from "@/hooks/analytics/useMinistryStats";

interface MinistryStatsCardsProps {
  params: MinistryStatsParams;
  enabled?: boolean;
}

/**
 * Cooperatives, submissions, pending and approved counts for the scope and
 * cooperative type in `params`, so a page counts only what it can analyse.
 */
export function MinistryStatsCards({ params, enabled = true }: MinistryStatsCardsProps) {
  const { t } = useOrganizationLabelsContext();
  const { data: stats } = useMinistryStats(params, enabled);

  if (!stats) return null;

  return (
    <MetricsGridCards
      columns={4}
      metrics={[
        {
          label: t("ministryAnalytics.totalCooperatives"),
          value: stats.total_cooperatives?.toLocaleString() ?? "—",
          tooltip: t("ministryAnalytics.totalCooperativesTooltip"),
        },
        {
          label: t("ministryAnalytics.totalSubmissions"),
          value: stats.total_submissions?.toLocaleString() ?? "—",
          tooltip: t("ministryAnalytics.totalSubmissionsTooltip"),
        },
        {
          label: t("ministryAnalytics.pendingReview"),
          value: stats.pending_review_count?.toLocaleString() ?? "—",
          tooltip: t("ministryAnalytics.pendingReviewTooltip"),
        },
        {
          label: t("ministryAnalytics.approved"),
          value: stats.approved_count?.toLocaleString() ?? "—",
          tooltip: t("ministryAnalytics.approvedTooltip"),
        },
      ]}
    />
  );
}
