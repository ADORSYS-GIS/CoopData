import { useTranslation } from "react-i18next";

import { IndicatorCard } from "@/components/analytics/basic/IndicatorCard";
import { GROUP_ORDER, groupIndicators } from "@/lib/basic-dashboard";
import type { DashboardScope, IndicatorValue } from "@/types/basic-dashboard";

interface IndicatorGroupSectionProps {
  indicators: IndicatorValue[];
  scope: Pick<DashboardScope, "currency">;
}

export function IndicatorGroupSection({ indicators, scope }: IndicatorGroupSectionProps) {
  const { t } = useTranslation();
  const grouped = groupIndicators(indicators);

  return (
    <div className="space-y-6">
      {GROUP_ORDER.filter((group) => grouped[group].length > 0).map((group) => (
        <section key={group} aria-labelledby={`basic-group-${group}`}>
          <h2
            id={`basic-group-${group}`}
            className="mb-3 font-heading text-sm font-bold uppercase tracking-wider text-foreground"
          >
            {t(`basicDashboard.groups.${group}`)}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {grouped[group].map((indicator) => (
              <IndicatorCard key={indicator.key} indicator={indicator} scope={scope} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
