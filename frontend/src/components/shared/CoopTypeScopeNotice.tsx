import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { InfoTooltip } from "@/components/ui/info-tooltip";
import { useAuth } from "@/context/AuthContext";

export type ScopeNoticePage = "analytics" | "benchmarking" | "basicAnalytics" | "basicBenchmarking";

const NOTICE_ROLES = ["ministry", "federation", "apex"];
const NOTICE_DURATION_MS = 6000;

/**
 * Tells ministry, federation and apex users which cooperative type a page
 * covers (SACCO or multipurpose). A short banner appears every time the page
 * opens, and the info icon in the page header shows the same message again.
 */
export function CoopTypeScopeNotice({ page }: { page: ScopeNoticePage }) {
  const { t } = useTranslation();
  const { role } = useAuth();
  const applies = !!role && NOTICE_ROLES.includes(role);
  const message = t(`scopeNotice.${page}`);

  useEffect(() => {
    if (!applies) return;
    toast.info(message, { id: `scope-notice-${page}`, duration: NOTICE_DURATION_MS });
  }, [applies, message, page]);

  if (!applies) return null;
  return <InfoTooltip text={message} className="size-5" />;
}
