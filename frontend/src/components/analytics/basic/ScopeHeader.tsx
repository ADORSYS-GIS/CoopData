import { Building2, CalendarDays, Coins, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { rateNote } from "@/lib/basic-dashboard";
import type { DashboardScope } from "@/types/basic-dashboard";

interface ScopeHeaderProps {
  scope: DashboardScope;
}

export function ScopeHeader({ scope }: ScopeHeaderProps) {
  const { t } = useTranslation();
  const rate = rateNote(scope);
  const LevelIcon = scope.level === "individual" ? Building2 : Users;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs">
      <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
        <LevelIcon className="size-3.5 text-primary" />
        {t(`basicDashboard.scope.${scope.level}`)}
      </span>
      <span className="text-muted-foreground">
        {t("basicDashboard.scope.reporting", {
          reporting: scope.cooperatives_reporting,
          total: scope.cooperatives_in_scope,
        })}
      </span>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CalendarDays className="size-3.5" />
        {t("basicDashboard.scope.period", { period: scope.period_label })}
      </span>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Coins className="size-3.5" />
        {t("basicDashboard.scope.currency", { currency: scope.currency })}
        {rate && <span>· {t("basicDashboard.scope.rate", { rate })}</span>}
      </span>
    </div>
  );
}
