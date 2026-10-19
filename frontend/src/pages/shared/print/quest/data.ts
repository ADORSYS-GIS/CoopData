import {
  compactNumber,
  currencyPrefix,
  humanizeKey,
  indicatorByKey,
  isNotReported,
} from "@/lib/basic-dashboard";
import { reportCode } from "@/lib/questionnaire-report";
import type { QuestionnaireReportProps } from "@/pages/shared/print/components/questionnaire/types";
import { fixed, grouped, localizePercent, percentText, tr } from "@/pages/shared/print/tpl/i18n";
import type { StatusTone } from "@/pages/shared/print/tpl/TplParts";
import type { DashboardScope, IndicatorValue, SeriesKey } from "@/types/basic-dashboard";

export const PAR30_LIMIT = 5;
export const PAR90_LIMIT = 2;

/** The PAR limit as written in the report language, e.g. "5%" or "5 %". */
export const par30Limit = (): string => localizePercent(`${PAR30_LIMIT}%`);

export const labelOf = (key: string): string =>
  tr(`quest.ind.${key}`, { defaultValue: humanizeKey(key) });

/** Definition of an indicator in the report language. */
export const definitionOf = (key: string, fallback: string): string =>
  tr(`quest.def.${key}`, { defaultValue: fallback });

/** A percentage in the report language, or the "not reported" wording when absent. */
export const pct = (value: number | null | undefined): string =>
  value == null ? tr("quest.not_reported_word") : percentText(value, 1);

/** An indicator value formatted with the report language's number conventions. */
export const reportValue = (
  indicator: IndicatorValue,
  scope: Pick<DashboardScope, "currency">,
): string => {
  if (isNotReported(indicator) || indicator.value === null) return "—";
  const { value, unit } = indicator;
  if (unit === "count") return grouped(Math.round(value));
  if (unit === "currency") return `${scope.currency} ${grouped(Math.round(value))}`;
  if (unit === "percent") return percentText(value, Math.abs(value) >= 10 ? 1 : 2);
  return fixed(value, 2);
};

export interface QuestAnalysis {
  props: QuestionnaireReportProps;
  ref: string;
  period: string;
  ind: (key: string) => IndicatorValue | undefined;
  num: (key: string) => number | null;
  text: (key: string) => string;
  money: (value: number) => string;
  line: (series: SeriesKey, key: string) => { labels: string[]; values: (number | null)[] };
}

export const analyseQuestionnaire = (props: QuestionnaireReportProps): QuestAnalysis => {
  const { dashboard, submissionId } = props;
  const { indicators, scope, series } = dashboard;
  const prefix = currencyPrefix(scope.currency);
  const ind = (key: string) => indicatorByKey(indicators, key);
  return {
    props,
    ref: reportCode(scope.reporting_year, submissionId, props.reference),
    period: scope.period_label || tr("quest.report.default_period"),
    ind,
    num: (key) => {
      const found = ind(key);
      return found && !isNotReported(found) ? found.value : null;
    },
    text: (key) => {
      const found = ind(key);
      return found ? reportValue(found, scope) : "—";
    },
    money: (value) => `${prefix}${compactNumber(value)}`,
    line: (name, key) => {
      const points = series[name] ?? [];
      return {
        labels: points.map((p) => p.period_label),
        values: points.map((p) => {
          const value = p.values[key];
          return typeof value === "number" && Number.isFinite(value) ? value : null;
        }),
      };
    },
  };
};

/** "▲ 3.2% on prior period" style note, or undefined when there is no comparison. */
export const changeNote = (indicator: IndicatorValue | undefined): string | undefined => {
  const change = indicator?.change_pct ?? null;
  if (!indicator || change === null || !Number.isFinite(change)) return undefined;
  return tr("common.on_prior", {
    arrow: change < 0 ? "▼" : "▲",
    change: percentText(Math.abs(change), 1),
    prior: tr("quest.prior_period"),
  });
};

/** Lower is better for risk and cost indicators. */
export const isDown = (indicator: IndicatorValue | undefined): boolean => {
  const change = indicator?.change_pct ?? 0;
  if (!indicator || change === 0) return false;
  const worseWhenHigher = indicator.group === "risk";
  return worseWhenHigher ? change > 0 : change < 0;
};

export const parTone = (value: number | null): StatusTone =>
  value === null ? "na" : value <= PAR30_LIMIT ? "ok" : value <= 10 ? "warn" : "bad";

export const minimumTone = (value: number | null, minimum: number): StatusTone =>
  value === null ? "na" : value >= minimum ? "ok" : value >= minimum * 0.8 ? "warn" : "bad";
