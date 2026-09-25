import { useTranslation } from "react-i18next";

import { MetricsGridCards } from "@/components/analytics/MetricsGridCards";
import { CollapsibleSection } from "@/components/analytics/national/CollapsibleSection";
import type { MetricCard, MetricGroup } from "@/components/analytics/national/metrics";

interface NationalMetricSectionsProps {
  headline: MetricCard[];
  groups: MetricGroup[];
  query: string;
  noResults: string;
}

const matches = (metric: MetricCard, needle: string): boolean =>
  `${metric.label} ${metric.trendValue ?? ""}`.toLowerCase().includes(needle);

export function NationalMetricSections({
  headline,
  groups,
  query,
  noResults,
}: NationalMetricSectionsProps) {
  const { t } = useTranslation();
  const needle = query.trim().toLowerCase();

  if (needle) {
    const found = groups
      .flatMap((group) => group.metrics)
      .filter((metric) => matches(metric, needle));
    return found.length > 0 ? (
      <MetricsGridCards metrics={found} columns={4} />
    ) : (
      <div className="py-12 text-center text-sm text-muted-foreground">{noResults}</div>
    );
  }

  return (
    <div className="space-y-6">
      {headline.length > 0 && (
        <CollapsibleSection
          id="national-headline"
          title={t("analytics.section.keyIndicators")}
          count={headline.length}
        >
          <MetricsGridCards metrics={headline} columns={4} />
        </CollapsibleSection>
      )}
      {groups.map((group) => (
        <CollapsibleSection
          key={group.id}
          id={`national-group-${group.id}`}
          title={group.title}
          count={group.metrics.length}
        >
          <MetricsGridCards metrics={group.metrics} columns={4} />
        </CollapsibleSection>
      ))}
    </div>
  );
}
