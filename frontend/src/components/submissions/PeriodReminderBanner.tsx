import { CalendarClock, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePeriodReminderText } from "@/components/submissions/PeriodReminderText";
import type { PeriodReminder } from "@/lib/period-rules";

interface PeriodReminderBannerProps {
  reminders: PeriodReminder[];
  onDismiss: (reminder: PeriodReminder) => void;
}

export function PeriodReminderBanner({ reminders, onDismiss }: PeriodReminderBannerProps) {
  const { t } = useTranslation();
  const describe = usePeriodReminderText();

  if (reminders.length === 0) return null;

  return (
    <div className="space-y-2" role="status">
      {reminders.map((reminder) => (
        <div
          key={`${reminder.year}-${reminder.periodType}`}
          className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("periodReminders.title", { year: reminder.year })}</p>
            <p className="mt-0.5 text-xs opacity-90">{describe(reminder)}</p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(reminder)}
            aria-label={t("periodReminders.dismiss")}
            className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-500/20"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
