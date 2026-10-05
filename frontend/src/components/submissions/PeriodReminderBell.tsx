import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { usePeriodReminderText } from "@/components/submissions/PeriodReminderText";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePeriodReminders } from "@/hooks/submissions/usePeriodReminders";

export function PeriodReminderBell() {
  const { t } = useTranslation();
  const describe = usePeriodReminderText();
  const { reminders } = usePeriodReminders(true);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("periodReminders.bell", { count: reminders.length })}
          className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
        >
          <Bell className="size-4" />
          {reminders.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {reminders.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">
          {t("periodReminders.notifications")}
        </div>
        {reminders.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            {t("periodReminders.none")}
          </p>
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {reminders.map((reminder) => (
              <li key={`${reminder.year}-${reminder.periodType}`} className="px-4 py-3 text-xs">
                <p className="font-semibold text-foreground">
                  {t("periodReminders.title", { year: reminder.year })}
                </p>
                <p className="mt-0.5 text-muted-foreground">{describe(reminder)}</p>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/app/submissions"
          className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-primary hover:bg-muted/50"
        >
          {t("periodReminders.goToSubmissions")}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
