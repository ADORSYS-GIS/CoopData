import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  deltaDirection,
  deltaTone,
  formatDelta,
  formatIndicatorValue,
  humanizeKey,
  isNotReported,
  toneClass,
} from "@/lib/basic-dashboard";
import type { DashboardScope, IndicatorValue } from "@/types/basic-dashboard";

interface IndicatorCardProps {
  indicator: IndicatorValue;
  scope: Pick<DashboardScope, "currency">;
  emphasis?: boolean;
}

const DELTA_ICON = { up: ArrowUp, down: ArrowDown, flat: ArrowRight } as const;

export function IndicatorCard({ indicator, scope, emphasis = false }: IndicatorCardProps) {
  const { t, i18n } = useTranslation();
  const label = t(`basicDashboard.indicators.${indicator.key}`, {
    defaultValue: humanizeKey(indicator.key),
  });
  const missing = isNotReported(indicator);
  const delta = missing ? null : formatDelta(indicator.change_pct);
  const Icon = DELTA_ICON[deltaDirection(indicator.change_pct)];

  const helpKey = `basicDashboard.help.${indicator.key}`;
  const description = i18n.exists(helpKey) ? t(helpKey) : null;
  const tooltipParts = [
    description ??
      `${t("basicDashboard.tooltip.formula")}: ${indicator.formula}${
        indicator.note ? `. ${t("basicDashboard.tooltip.note")}: ${indicator.note}` : ""
      }`,
    indicator.status === "approximate" ? t("basicDashboard.status.approximateHint") : null,
    missing ? t("basicDashboard.status.notReportedHint") : null,
  ].filter((part): part is string => part !== null);

  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 ${
        emphasis ? "ring-1 ring-primary/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <InfoTooltip text={`${label}. ${tooltipParts.join(" ")}`} />
      </div>
      <div
        className={`mt-2 font-heading text-2xl font-bold tabular-nums ${
          missing ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {formatIndicatorValue(indicator, scope)}
      </div>
      <div className="mt-1 flex min-h-5 flex-wrap items-center gap-2 text-xs">
        {missing ? (
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
            {t("basicDashboard.status.notReported")}
          </span>
        ) : (
          <>
            {delta && (
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${toneClass(
                  deltaTone(indicator),
                )}`}
                title={t("basicDashboard.tooltip.vsPrevious")}
              >
                <Icon className="size-3" />
                {delta}
              </span>
            )}
            {indicator.status === "approximate" && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 font-semibold text-warning">
                {t("basicDashboard.status.approximate")}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
