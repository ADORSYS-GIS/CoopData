import { useTranslation } from "react-i18next";

import type { PeriodReminder, PeriodType } from "@/lib/period-rules";

const FREQUENCY_KEY: Record<PeriodType, string> = {
  YEARLY: "yearly",
  QUARTERLY: "quarterly",
  MONTHLY: "monthly",
  SEMI_ANNUAL: "semiAnnual",
};

export const usePeriodReminderText = () => {
  const { t, i18n } = useTranslation();

  const periodLabel = (type: PeriodType, value: string): string => {
    if (type !== "MONTHLY") return value;
    const month = Number.parseInt(value, 10);
    return new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(
      new Date(2000, month - 1, 1),
    );
  };

  return (reminder: PeriodReminder): string =>
    t("periodReminders.message", {
      year: reminder.year,
      frequency: t(`periodReminders.frequency.${FREQUENCY_KEY[reminder.periodType]}`),
      periods: reminder.missing.map((value) => periodLabel(reminder.periodType, value)).join(", "),
    });
};
