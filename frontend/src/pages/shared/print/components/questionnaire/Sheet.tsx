import React from "react";
import { useTranslation } from "react-i18next";

import { formatIndicatorValue, isNotReported } from "@/lib/basic-dashboard";
import type { DashboardScope, IndicatorValue } from "@/types/basic-dashboard";

interface SheetProps {
  title: string;
  subtitle?: string;
  pageLabel: string;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ title, subtitle, pageLabel, children }) => (
  <div className="report-sheet relative w-[210mm] min-h-[268mm] p-14 block break-after-page bg-white font-sans">
    <div className="mb-6 border-b-2 border-slate-900 pb-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
        {pageLabel}
      </p>
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
    {children}
  </div>
);

export const SubHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-slate-700">
    {children}
  </h3>
);

interface TileProps {
  indicator: IndicatorValue;
  scope: Pick<DashboardScope, "currency">;
  dense?: boolean;
}

export const IndicatorTile: React.FC<TileProps> = ({ indicator, scope, dense }) => {
  const { t } = useTranslation();
  const missing = isNotReported(indicator);
  return (
    <div className="page-break-inside-avoid rounded border border-slate-200 bg-white p-2.5">
      <p
        className={`font-bold tabular-nums ${dense ? "text-base" : "text-lg"} ${missing ? "text-slate-300" : "text-slate-900"}`}
      >
        {formatIndicatorValue(indicator, scope)}
        {indicator.status === "approximate" && (
          <span className="ml-1 align-super text-[9px] font-semibold text-amber-600">≈</span>
        )}
      </p>
      <p className="text-[10px] leading-tight text-slate-500">
        {t(`basicDashboard.indicators.${indicator.key}`)}
      </p>
    </div>
  );
};

export const IndicatorGrid: React.FC<{
  indicators: IndicatorValue[];
  scope: Pick<DashboardScope, "currency">;
  columns?: 3 | 4 | 5;
  dense?: boolean;
}> = ({ indicators, scope, columns = 4, dense }) => {
  const cols = { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" }[columns];
  return (
    <div className={`grid ${cols} gap-2`}>
      {indicators.map((indicator) => (
        <IndicatorTile key={indicator.key} indicator={indicator} scope={scope} dense={dense} />
      ))}
    </div>
  );
};
