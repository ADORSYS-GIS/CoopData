import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FREQUENCY_LABEL_KEYS, MONTH_NAMES, type CreateBlock } from "@/lib/period-rules";

interface CreateBlockNoticeProps {
  block: CreateBlock;
  year: number;
}

/** Says why "Create submission" is not available for the current choice. */
export function CreateBlockNotice({ block, year }: CreateBlockNoticeProps) {
  const { t } = useTranslation();

  const message = (() => {
    switch (block.reason) {
      case "frequency":
        return t("periodReminders.block.frequency", {
          year,
          frequency: t(FREQUENCY_LABEL_KEYS[block.periodType]).toLowerCase(),
        });
      case "startMonth":
        return t("periodReminders.block.startMonth", {
          year,
          month: MONTH_NAMES[block.month - 1],
        });
      case "taken":
        return t("periodReminders.block.taken", {
          year,
          period: MONTH_NAMES[Number(block.period) - 1] ?? block.period,
        });
      case "fullYearOverlap":
        return t("periodReminders.block.fullYearOverlap", { year });
    }
  })();

  return (
    <p
      role="status"
      data-testid="create-block-notice"
      className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
