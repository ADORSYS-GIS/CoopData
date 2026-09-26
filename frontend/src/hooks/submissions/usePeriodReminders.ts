import { useCallback, useMemo, useState } from "react";

import { useCooperativeSubmissions } from "@/hooks/submissions/useSubmissions";
import { periodReminders, reminderKey, type PeriodReminder } from "@/lib/period-rules";

const STORAGE_KEY = "coopdata:period-reminders-dismissed";

const readDismissed = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

/**
 * Missing periods for the years the cooperative already reports in. The bell
 * shows all of them; the banner hides the ones the user dismissed.
 */
export const usePeriodReminders = (enabled: boolean) => {
  const { data: submissions = [] } = useCooperativeSubmissions(enabled);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const reminders = useMemo(
    () => (enabled ? periodReminders(submissions) : []),
    [enabled, submissions],
  );
  const visible = useMemo(
    () => reminders.filter((reminder) => !dismissed.includes(reminderKey(reminder))),
    [reminders, dismissed],
  );

  const dismiss = useCallback((reminder: PeriodReminder) => {
    setDismissed((prev) => {
      const next = [...prev, reminderKey(reminder)];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: dismissal lasts for this session only */
      }
      return next;
    });
  }, []);

  return { reminders, visible, dismiss };
};
