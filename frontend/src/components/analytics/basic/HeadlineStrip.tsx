import { IndicatorCard } from "@/components/analytics/basic/IndicatorCard";
import { HEADLINE_KEYS, indicatorByKey } from "@/lib/basic-dashboard";
import type { DashboardScope, IndicatorValue } from "@/types/basic-dashboard";

interface HeadlineStripProps {
  indicators: IndicatorValue[];
  scope: Pick<DashboardScope, "currency">;
}

export function HeadlineStrip({ indicators, scope }: HeadlineStripProps) {
  const headline = HEADLINE_KEYS.map((key) => indicatorByKey(indicators, key)).filter(
    (indicator): indicator is IndicatorValue => indicator !== undefined,
  );
  if (headline.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {headline.map((indicator) => (
        <IndicatorCard key={indicator.key} indicator={indicator} scope={scope} emphasis />
      ))}
    </div>
  );
}
