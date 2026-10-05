import en from "@/i18n/locales/en.json";
import {
  compactNumber,
  currencyPrefix,
  formatDelta,
  formatIndicatorValue,
  humanizeKey,
  indicatorByKey,
  isNotReported,
} from "@/lib/basic-dashboard";
import { reportCode } from "@/lib/questionnaire-report";
import type { QuestionnaireReportProps } from "@/pages/shared/print/components/questionnaire/types";
import type { StatusTone } from "@/pages/shared/print/tpl/TplParts";
import type { IndicatorValue, SeriesKey } from "@/types/basic-dashboard";

const LABELS = en.basicDashboard.indicators as Record<string, string>;

export const PAR30_LIMIT = 5;
export const PAR90_LIMIT = 2;

export const labelOf = (key: string): string => LABELS[key] ?? humanizeKey(key);

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
    ref: reportCode(scope.reporting_year, submissionId),
    period: scope.period_label || "Reporting period",
    ind,
    num: (key) => {
      const found = ind(key);
      return found && !isNotReported(found) ? found.value : null;
    },
    text: (key) => {
      const found = ind(key);
      return found ? formatIndicatorValue(found, scope) : "—";
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
  const delta = formatDelta(indicator?.change_pct ?? null);
  if (!delta || !indicator) return undefined;
  return `${(indicator.change_pct ?? 0) < 0 ? "▼" : "▲"} ${delta.replace(/^[+-]/, "")} on prior period`;
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
