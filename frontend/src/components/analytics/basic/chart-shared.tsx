import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/app-shell";
import { CHART_HEIGHT } from "@/components/analytics/basic/chart-config";

interface ChartCardProps {
  title: string;
  subtitle: string;
  info: string;
  hasData: boolean;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, info, hasData, children, className }: ChartCardProps) {
  const { t } = useTranslation();
  return (
    <Card
      title={title}
      subtitle={subtitle}
      info={info}
      className={`!shadow-none hover:!shadow-none ${className ?? ""}`}
    >
      {hasData ? (
        <div style={{ height: CHART_HEIGHT }} className="w-full">
          {children}
        </div>
      ) : (
        <div
          className="flex items-center justify-center text-xs text-muted-foreground"
          style={{ height: CHART_HEIGHT }}
        >
          {t("basicDashboard.charts.noData")}
        </div>
      )}
    </Card>
  );
}
