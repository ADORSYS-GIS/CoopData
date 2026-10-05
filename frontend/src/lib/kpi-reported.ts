export const NOT_REPORTED_KPI = "—";

/** The backend prints a dash for a ratio whose inputs were not reported. */
export const isReportedKpi = (kpi: { formatted?: string | null } | null | undefined): boolean =>
  kpi !== null && kpi !== undefined && kpi.formatted !== NOT_REPORTED_KPI;
