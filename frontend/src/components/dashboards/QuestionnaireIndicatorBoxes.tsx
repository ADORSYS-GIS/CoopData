import { useTranslation } from "react-i18next";

import {
  HEADLINE_KEYS,
  formatIndicatorValue,
  humanizeKey,
  indicatorByKey,
  isNotReported,
} from "@/lib/basic-dashboard";
import type { DashboardScope, IndicatorValue } from "@/types/basic-dashboard";
import { MetricBox } from "./MetricBox";

interface QuestionnaireIndicatorBoxesProps {
  indicators: IndicatorValue[];
  scope: Pick<DashboardScope, "currency">;
}

/** The questionnaire's headline indicators, in the dashboard's standard boxes. */
export function QuestionnaireIndicatorBoxes({
  indicators,
  scope,
}: QuestionnaireIndicatorBoxesProps) {
  const { t } = useTranslation();
  const headline = HEADLINE_KEYS.map((key) => indicatorByKey(indicators, key)).filter(
    (indicator): indicator is IndicatorValue => indicator !== undefined,
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {headline.map((indicator) => {
        const missing = isNotReported(indicator);
        return (
          <MetricBox
            key={indicator.key}
            label={t(`basicDashboard.indicators.${indicator.key}`, {
              defaultValue: humanizeKey(indicator.key),
            })}
            value={missing ? undefined : formatIndicatorValue(indicator, scope)}
            footnote={missing ? t("basicDashboard.status.notReported") : undefined}
          />
        );
      })}
    </div>
  );
}
