import { PAR30_LIMIT, par30Limit } from "@/pages/shared/print/quest/data";
import { tr } from "@/pages/shared/print/tpl/i18n";
import type { DonutSlice } from "@/pages/shared/print/tpl/TplTrend";
import type { BasicDashboardResponse, CooperativeRow } from "@/types/basic-dashboard";

export interface TestCount {
  meets: number;
  below: number;
  notReported: number;
}

export interface Compliance {
  par30: TestCount;
  operatingMargin: TestCount;
  reserveCoverage: TestCount;
  /** Cooperatives by PAR over 30 days: within the limit, up to 10%, above 10%, not reported. */
  parBands: { within: number; watch: number; above: number; notReported: number };
}

const tally = (
  rows: readonly CooperativeRow[],
  pick: (row: CooperativeRow) => number | null,
  meets: (value: number) => boolean,
): TestCount => {
  const out: TestCount = { meets: 0, below: 0, notReported: 0 };
  for (const row of rows) {
    const value = pick(row);
    if (value === null) out.notReported += 1;
    else if (meets(value)) out.meets += 1;
    else out.below += 1;
  }
  return out;
};

/** How many cooperatives meet each regulatory limit. `below` also counts PAR above its limit. */
export const complianceOf = (dashboard: BasicDashboardResponse): Compliance => {
  const rows = dashboard.cooperatives;
  const par = (row: CooperativeRow) => row.par_gt_30_pct;
  return {
    par30: tally(rows, par, (v) => v <= PAR30_LIMIT),
    operatingMargin: tally(
      rows,
      (r) => r.total_operating_margin_pct,
      (v) => v >= 0,
    ),
    reserveCoverage: tally(
      rows,
      (r) => r.monetary_reserve_coverage_pct,
      (v) => v >= 100,
    ),
    parBands: {
      within: rows.filter((r) => par(r) !== null && (par(r) ?? 0) <= PAR30_LIMIT).length,
      watch: rows.filter((r) => (par(r) ?? -1) > PAR30_LIMIT && (par(r) ?? 0) <= 10).length,
      above: rows.filter((r) => (par(r) ?? 0) > 10).length,
      notReported: rows.filter((r) => par(r) === null).length,
    },
  };
};

export const parBandSlices = (c: Compliance): DonutSlice[] => [
  { label: tr("quest.cons.slice_within", { limit: par30Limit() }), value: c.parBands.within },
  { label: tr("quest.cons.slice_watch", { limit: par30Limit() }), value: c.parBands.watch },
  { label: tr("quest.cons.slice_above"), value: c.parBands.above },
  { label: tr("status.not_reported"), value: c.parBands.notReported },
];

export interface Coverage {
  reporting: number;
  inScope: number;
  missing: number;
  rate: number;
}

export const coverageOf = (dashboard: BasicDashboardResponse): Coverage => {
  const { cooperatives_reporting: reporting, cooperatives_in_scope: inScope } = dashboard.scope;
  return {
    reporting,
    inScope,
    missing: Math.max(inScope - reporting, 0),
    rate: inScope > 0 ? (reporting / inScope) * 100 : 0,
  };
};
