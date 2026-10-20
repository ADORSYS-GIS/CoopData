import { useTranslation } from "react-i18next";

import { FREQUENCY_LABEL_KEYS } from "@/lib/period-rules";
import {
  monthsCoveredLabel,
  periodFromSubmission,
  periodMonths,
  periodShortLabel,
  type SubmissionPeriodSource,
} from "@/pages/cooperative/manual-entry/period";

interface SubmissionPeriodTagProps {
  submission: SubmissionPeriodSource;
}

/**
 * The period of a quarterly, half-yearly or monthly submission, e.g.
 * " · Q2 (Apr – Jun) · Quarterly", to follow the reporting year. Nothing for a
 * yearly return: the year says it all.
 */
export function SubmissionPeriodTag({ submission }: SubmissionPeriodTagProps) {
  const { t } = useTranslation();
  const period = periodFromSubmission(submission);
  if (period.periodType === "YEARLY") return null;

  const short = periodShortLabel(period);
  const months = monthsCoveredLabel(
    periodMonths(period.periodType, period.periodValue, period.startMonth),
  );
  const name = !short
    ? t("manualEntry.periodBar.fullYear", { year: period.year })
    : months && months !== short
      ? `${short} (${months})`
      : short;

  return (
    <span data-testid="submission-period">
      {" · "}
      <span className="font-semibold text-foreground">{name}</span>
      {" · "}
      <span className="font-medium">{t(FREQUENCY_LABEL_KEYS[period.periodType])}</span>
    </span>
  );
}
