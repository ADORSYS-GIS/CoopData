import { useTranslation } from "react-i18next";

import { CollapsibleSection } from "@/components/analytics/national/CollapsibleSection";
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
        <CollapsibleSection
          key={group}
          id={`basic-group-${group}`}
          title={t(`basicDashboard.groups.${group}`)}
          count={grouped[group].length}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {grouped[group].map((indicator) => (
              <IndicatorCard key={indicator.key} indicator={indicator} scope={scope} />
            ))}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
}
